# Outreach Engine — Project Guide

## What this is

Outreach Engine runs the full lifecycle of B2B cold outreach: find prospects → find/verify a contact email → draft a personalized message → hold it for human approval → send → classify and draft replies. Instagram DM is a parallel, manual-send channel for the same pipeline.

It is built as a platform, not a single campaign. A **Business Line** is one brand/venture running through the system (its own domain, sending inboxes, catalogue, templates, targeting, and sending limits). Onboarding a new Business Line is a data operation — a new row plus config — not a code change.

## Repo layout

```
apps/
  api/                NestJS HTTP API + background workers
  web/                Next.js (App Router) operator console
packages/
  db/                 Prisma schema (single source of truth), migrations, generated client, seed
  types/              Shared TS DTOs/enums, used by both apps
  config/             Shared eslint config + base tsconfig
  compliance-rules/   The 5-check send chokepoint — pure, unit-tested functions
  enrichment/         EmailFinder / EmailVerifier interfaces + adapters
  llm-provider/       LLMProvider interface — Groq (default) / Claude Haiku (gated) drafting adapters
```

## Data model

`packages/db/prisma/schema.prisma` is the single source of truth for the domain. The shape that matters most:

- **`BusinessLine`** — the tenant. Everything below is scoped to one. `sendLimits.perInboxPerDay`/`igPerDay` are real and enforced by the compliance chokepoint; `sendLimits.rampSchedule` is stored but **not read or enforced anywhere** — flagged as a real gap, needs a design discussion before it's built, not silently treated as "already handled."
- **`Product`** / **`ProductVariant`** — the catalogue being sold.
- **`Template`** — reusable message skeletons (`email_outbound`, `email_reply`, `instagram_dm`) with `{{token}}` placeholders.
- **`TargetingProfile`** — the criteria a discovery batch runs against.
- **`Business`** → **`Lead`** — a discovered company, and a specific outreach attempt tied to a product/business line.
- **`Draft`** / **`DmDraft`** / **`ReplyDraft`** — AI-generated message content awaiting approval, each recording the grounding facts given to the model.
- **`Send`** / **`DmSend`** — the record of an actual send. `Send.approvedVia` (`"webapp" | "telegram"`) and `Send.approvedByUserId` capture who approved it and how — this is a real part of the API/DTO contract, not internal bookkeeping, because the operator console needs to distinguish a webapp send from a Telegram-approved one in every queue.
- **`Reply`** → **`ReplyDraft`** — an inbound reply, its classification, and a drafted response.
- **`SuppressionEntry`** — the do-not-contact list, checked before every send.
- **`Batch`** — one discovery/enrichment/drafting run against a `TargetingProfile`.

Every business-scoped model carries a `businessLineId` column. That is enforced, not a convention — see below.

## Guardrails

These are architectural constraints enforced in code, not by convention:

1. **No send bypasses the compliance chokepoint.** `packages/compliance-rules`'s `runComplianceChokepoint` runs five checks — email verified, not suppressed, compliance footer present, sending inbox warmed up, inbox daily cap not exceeded — and returns *every* failing reason, not just the first. `apps/api`'s `sending.attemptSend(draftId, approvedByUserId, approvedVia)` is the only function allowed to write a `Send` row, and it always calls the chokepoint first. This holds regardless of who approved the send: the webapp's Send button and the Telegram bot's Approve callback both call this exact method, differing only in `approvedVia`. There is no second path — a repo-wide test (`send-write-path.spec.ts`) scans the source tree and fails if a second `prisma.send.create` call site ever appears. `Send.draftId` also carries a real `@@unique` DB constraint as a hard backstop against a double-send.
2. **No two decisions can land on the same lead.** Approve (webapp or Telegram), Reject (webapp or Telegram), Regenerate (webapp or Telegram), and Skip all compete for the same `Lead` — since Telegram notifications broadcast to everyone, two people acting on the same draft at once is a real scenario, not a hypothetical. `common/claim-lead.ts`'s `claimLeadForDecision` is the single enforcement point: an atomic conditional update (`'drafted' → 'queued'`) means only the first of two near-simultaneous actions succeeds; the other gets a clear "already handled by X" result instead of silently double-processing. `attemptSend`, `QueueService.rejectLead`/`regenerateDraft`/`skipLead`, and their Telegram equivalents (`common/lead-actions.ts`) all call it before doing anything irreversible.
3. **No code path sends an Instagram DM automatically.** Instagram is manual-send only: the operator copies the drafted message and sends it themselves in the Instagram app; `DmSend` only logs that it happened.
4. **Every business-scoped query is scoped, automatically.** `apps/api`'s `common/business-line-scope` resolves the active Business Line from the `X-Business-Line-Id` request header via a request-scoped `BusinessLineContext`, and hands services a Prisma client wrapped in a Client Extension that force-injects `businessLineId` into every query for every scoped model. A developer calling `businessLineContext.db.lead.findMany()` cannot forget the filter or override it with a different id — the extension always wins.

## Compliance chokepoint, in detail

`packages/compliance-rules` defines five checks (`checkEmailVerified`, `checkNotSuppressed`, `checkFooterPresent`, `checkWarmupComplete`, `checkInboxCapNotExceeded`) and `runComplianceChokepoint(ctx, checks?)`, which runs all five and aggregates `{ allowed, blockedReasons[] }`. All five are real, DB-backed queries now (not stubs) — verified live: the seeded "Stink Safe" business line (`warmupComplete: false`, `postalAddress: null`) produces real, correct blocked-reason banners in the browser. The aggregator's "any one failure blocks everything" and "surface every reason, not just the first" behaviors are unit-tested independent of the checks' internals.

`apps/api`'s `compliance` module wraps this for the rest of the app; `sending.attemptSend` is the only caller that matters — see Guardrail 1.

## Enrichment

`packages/enrichment` defines `EmailFinder`/`EmailVerifier` interfaces. Two implementations exist:

- **`WebsiteScraperFinder` / `MxRecordVerifier`** — free, no external API, active by default.
- **`HunterFinder` / `HunterVerifier`** — real calls against Hunter.io's `domain-search` and `email-verifier` endpoints, fully implemented but **inactive by default**.

`createEnrichmentAdapters()` is the only entry point anything should call. It reads `ENRICHMENT_FALLBACK` (`"none"` default, or `"hunter"`) — when set to `"hunter"`, Hunter is wrapped in as a fallback that's tried only when the free method comes back empty, not a full replacement. No other code should know or care which implementation is active.

## Discovery → enrichment → drafting pipeline

A real, end-to-end BullMQ pipeline (`discovery` → `enrichment` → `drafting` queues in `apps/api/src/queues/`), triggered by `POST /batches` (`admin`-only — it spends real Google Places + LLM API quota):

1. **Discovery** (`apps/api/src/modules/discovery/`) — `google-places.client.ts` calls the real Google Places API (New) `places:searchText` endpoint for a `TargetingProfile`'s keywords against a geography string. Results matching an `exclusions` entry are skipped; results already in `Business.googlePlaceId` or the suppression list are deduped/skipped; everything else becomes a real `Business` + `Lead` row, and enqueues an `enrichment` job.
2. **Enrichment** — calls the existing `EmailFinder`/`EmailVerifier` adapters (see above), writes `Lead.email`/`emailStatus`, always enqueues the `drafting` job next (a failed email find still gets a draft — the compliance chokepoint is what actually gates sending, not this stage).
3. **Drafting** — `DraftingService` (`apps/api/src/modules/drafting/`) assembles grounding facts from the `Business`/`Product`/`BusinessLine` (deliberately never including `ProductVariant.price` — cold copy must never quote price), builds the prompt and content rules, calls `getLLMProvider().generateDraft(...)` (see below), and appends the compliance footer deterministically in code — never trusted to the model. Writes a real `Draft` row.

No schema relation links `Lead`/`Draft` back to the `Batch` that produced them — each stage instead reports its own counts into `Batch.stats` (a JSON blob) via a small read-modify-write helper, good enough at this scale (single-digit to low-double-digit leads per batch, one BullMQ worker per queue) but not a general-purpose atomic counter.

**Regenerate** (`POST /queue/review/:leadId/regenerate`, and the equivalent Telegram callback) is real — it re-runs the exact same `loadDraftGroundingInput` → `DraftingService.draftEmail` steps for one already-discovered lead (not a new discovery/targeting run) and writes a new, separately-versioned `Draft` row. The review queue already reads `drafts` ordered by `version desc`, so a regenerated draft is picked up with no read-side change. Shares its enforcement (the atomic claim, see Guardrail 2) and its input-assembly (`apps/api/src/modules/drafting/load-draft-input.ts`) with the automated pipeline, so the two can't quietly drift apart.

### LLM provider abstraction — `packages/llm-provider`

`LLMProvider` interface (`generateDraft(input: {prompt}) → {subject, body, openPlaceholders}`) with two real implementations, same on/off-adapter pattern as `EmailFinder`/`EmailVerifier` above:

- **`GroqProvider`** (`llama-3.3-70b-versatile` via the official `groq-sdk`) — **active default**.
- **`HaikuProvider`** (Claude Haiku via `@anthropic-ai/sdk`, structured JSON-schema output) — fully real, gated off by default.

`getLLMProvider()` switches on `LLM_PROVIDER` (`"groq"` default | `"haiku"`) — no other code should know or care which is active. Grounding-fact assembly, content rules, and the compliance-footer append all live in `DraftingService`, above this abstraction, so they apply identically regardless of which provider is active.

## Business Line scoping

- `BusinessLineContext` (request-scoped) resolves the active line from `X-Business-Line-Id` and exposes `.db`, a Prisma client scoped to it.
- `scoped-prisma.ts` defines the extension: it force-overwrites `businessLineId` in the `where`/`data`/`create` args of every operation against every model listed in `BUSINESS_LINE_SCOPED_MODELS`, even if a caller supplied its own value.
- Services depend on `BusinessLineContext`, never the raw `prisma` export, for anything business-scoped.

## Backend (`apps/api`)

NestJS, TypeScript, CommonJS. Boots on `PORT` (default `3001`). `GET /health` does a real Redis `PING` (2s timeout) against the shared BullMQ connection, not just a `.status` check — a Redis connection can stay `'ready'` while every command is being rejected (e.g. a metered Redis plan's command quota being exhausted), so this is the only way to distinguish "actually working" from "silently broken." Returns `{status: 'ok'|'degraded', redis: {ok, error?}}`.

Module map:

| Module | Status | Notes |
|---|---|---|
| `business-lines` | Real CRUD | Reads: `admin`+`operator`. Writes: `admin`-only. |
| `catalogue`, `targeting`, `templates` | Real CRUD | Scoped via `BusinessLineContext`. Reads: `admin`+`operator`; writes: `admin`-only (config work) |
| `discovery` | Real | `POST /batches` (admin-only) → real Google Places pipeline — see above |
| `drafting` | Real | `DraftingService` + `packages/llm-provider` — see above |
| `suppression` | Real CRUD | Scoped via `BusinessLineContext` |
| `compliance` | Real | Wraps the chokepoint; all 5 checks are real DB-backed queries |
| `sending` | Real | The sole `Send`-writer (`attemptSend`); simulated mode when `INSTANTLY_API_KEY` is blank |
| `auth` | Real | BetterAuth, Postgres-backed (`@better-auth/prisma-adapter`), email+password, `admin`/`operator` roles |
| `queue` | Real | Review/Reply/DM queue reads + skip/reject/mark-handled actions, all real `Lead`/`Draft`/`Reply` data |
| `enrichment` | Real | Real adapter wiring, real call sites (via the discovery pipeline's `EnrichmentProcessor`) |
| `replies` | Partial | Queue reads + skip/mark-handled/escalate are real. Reply **"Send" is a no-op** — no modeled `Send`↔`ReplyDraft` link in the schema, and building one was never worth doing while sending itself wasn't real (Instantly/Smartlead currently blocked on a DKIM issue, unrelated to this codebase). Nothing creates a real `Reply` either — no inbound-email ingestion exists; only hand-seeded fixtures. Blocked on the sending gap, not a separate oversight. |
| `instagram` | Stub | No real pipeline exists at all, not just "no send capability" — `apps/api/src/modules/instagram/` is a single empty module file (no controller/service), and `DmDraft` is only ever created by `seed.ts`. Deliberately deferred; Guardrail 2 (no automatic DM send) is the *design* constraint this will still respect once a real pipeline exists. |
| `notifications` | Real | `POST /telegram/webhook`, secret-verified. Outbound: `DraftingProcessor` calls `TelegramService.notifyDraftReady` on every new `Draft`, broadcasting to every `admin`/`operator` `User` with a linked `telegramUserId` (no per-business-line routing — see Business Line scoping below) with a real inline keyboard (Approve/Reject/Regenerate). Inbound: `"approve:<draftId>"`/`"reject:<leadId>"`/`"regenerate:<leadId>"` callbacks all resolve the linked `User` and go through the same enforcement as the webapp — see Guardrail 1 and the concurrency note below. Every callback gets a real `answerCallbackQuery` response so the button visibly resolves. |
| `users` | Real | Admin-only user provisioning (`GET/POST /users`, `POST /users/:id/reset-password`, `DELETE /users/:id`) — see Auth below. Not business-line-scoped. |

**Auth**: BetterAuth mounted at `/api/auth/*` directly on the underlying Express instance (its handler needs the raw request body, so Nest's body parser is disabled and re-applied manually for every other route). BetterAuth is Postgres-backed via `@better-auth/prisma-adapter` (`Session`/`Account`/`Verification` models extend the locked schema; `User` gained `name`/`emailVerified`/`image`/`updatedAt`, its original domain columns untouched). Demo accounts (`admin@stinksafe.co.uk`, `operator@stinksafe.co.uk`) were created via BetterAuth's own `signUpEmail`, not raw inserts, so password hashing is guaranteed compatible. `role` rides on the session as a BetterAuth `additionalField`, read by `RolesGuard`/`@Roles()` to gate routes — several controllers split reads (`admin`+`operator`) from writes (`admin`-only) per-method; see the module table above. `BETTER_AUTH_SECRET` must be set in production; the app throws on boot if it's missing there (a fixed insecure fallback exists only for local dev/test).

BetterAuth's official `admin` plugin (`auth.config.ts`) powers the `users` module — `createUser`/`setUserPassword`/`removeUser`, all reusing BetterAuth's own password hashing rather than a hand-rolled reset path. Registered with custom `admin`/`operator` access-control roles (via `better-auth/plugins/access`) rather than the plugin's built-in `admin`/`user` — `"operator"` isn't a role the plugin's default permission set recognizes otherwise. Requires `User.banned`/`banReason`/`banExpires` and `Session.impersonatedBy` columns (added via migration; unused by our own API surface — no ban/impersonate routes are exposed, though they do technically exist on BetterAuth's own `/api/auth/admin/*` surface for any `admin`-role session).

**Queues**: BullMQ (`@nestjs/bullmq`), real connection to Upstash Redis (`REDIS_URL`). Three queues — `discovery`, `enrichment`, `drafting` — each with a real processor (see the pipeline section above), chained: a discovery job enqueues one enrichment job per lead found, which enqueues one drafting job each. `env` must be loaded before any of these modules evaluate (`new IORedis(...)` runs at module-decoration time) — see `apps/api/src/load-env.ts` and its comment before adding new top-level `process.env` reads.

Each processor sets `drainDelay: 120` (seconds) and `stalledInterval: 300_000` (ms), well above BullMQ's defaults (5s / 30s) — this pipeline is manually triggered a handful of times a day, not continuous-throughput, and the default idle-polling cadence alone can exceed a metered Redis plan's monthly command quota before any real batch runs (confirmed: this is what happened to Upstash's free-tier 500K/month cap here). Blocking waits still return instantly on a real enqueued job regardless of `drainDelay` — raising it costs nothing in responsiveness. The shared connection also sets a capped exponential `retryStrategy` (1s → 30s) and routes its `'error'` events through `redis-error-logger.ts`, which rate-limits identical repeated errors to once per 60s instead of flooding the log — `maxRetriesPerRequest` stays `null` on this connection regardless (bullmq requires it for Worker/blocking connections; it also isn't the right lever for a command-level `ReplyError` on an already-open connection, which ioredis never auto-retries anyway).

## Frontend (`apps/web`)

Next.js App Router + Tailwind, IBM Plex Sans/Mono. Dark theme by default; light theme is a real CSS-variable override (`app/globals.css`), not a filter.

- **Routes**: `/login`, `/review`, `/replies`, `/instagram`, `/admin/lines`, `/admin/catalogue` (tabs: catalogue | templates | targeting), `/admin/batches`, `/admin/users`. Role gating happens in `app/(app)/layout.tsx` — operators are redirected out of `/admin/*` client-side (the API itself is also role-gated per-method — see the backend module table — so this isn't the only enforcement point; `/users` in particular has zero operator access at all, not even reads).
- **State**: `lib/state/app-state.tsx` is a single client context holding session, theme, active Business Line (+ the 650ms skeleton on switch), all three queues' items/selections/decisions/drafts, and the admin screens' local state. It's the React equivalent of the original design prototype's single-component state — same behavior, idiomatic implementation.
- **Data layer**: `lib/data/*.ts` are real `apiFetch` calls against `apps/api` for essentially everything now — queues, Business Lines, Catalogue (Products+Variants), Templates, Targeting Profiles, Batches, Users, Health. `apiFetch` (`lib/api-client.ts`) sets `cache: 'no-store'` — several of these screens re-fetch immediately after a create/update on the same page, and the browser's default HTTP cache will otherwise silently serve the pre-mutation response. `lib/mock-data.ts` still exists but is now down to genuinely static UI config (the template-token vocabulary, batch-history stat-tile fixture) — its old `lines`/`reviewItems`/`replyItems`/`dmItems`/`catalogue`/`targeting`/`templates`/`batches` fixtures are dead code, nothing imports them.
- **Admin — Batches** (`admin/batches`): the "Run a batch" form (targeting profile / product / geography / size) triggers the real discovery pipeline via `POST /batches` — not a placeholder. Also polls `GET /health` every 60s and shows an amber banner if Redis is unreachable, since that's the one visible symptom of a batch silently never progressing.
- **Admin — Targeting profiles** (inside `admin/catalogue`): supports inline **Edit** on an existing profile (name/place-types/keywords/exclusions), not just create-new — the shared `TargetingProfileForm` component backs both flows.
- **Admin — Users** (`admin/users`): create a login (email + optional display name + role), shown once via a generated-password reveal panel; list all users; reset a user's password (same reveal pattern); remove a user. Entirely `admin`-only — see the backend module table.
- **Badges/tokens**: `lib/badges.ts` centralizes the status-badge color formula (`color+'22'` background, `color+'44'` border). Design tokens are CSS variables in `globals.css`, mapped into Tailwind via `tailwind.config.ts` (custom `oe:` breakpoint at 900px, matching the design spec's one responsive breakpoint).
- **Keyboard shortcuts**: `lib/hooks/use-queue-keyboard.ts` — J/K or arrows navigate the pending list on any queue screen; Review additionally binds Enter/S/X/G to send/skip/reject/regenerate. Suppressed while an input/textarea is focused.

### Telegram-approved items in the UI

A queue item that was approved via the Telegram bot (rather than the webapp's Send button) carries `approvedVia: 'telegram'` on its decision. The done-state badge renders "sent · Telegram" instead of plain "sent" so an operator can tell the two apart in the list. Real-time reflection of a Telegram-side approval while the webapp is open (the item disappearing/updating live) is a polling/webhook-revalidation concern for the real-backend phase — the data shape already supports it.

## Local development

```
cp .env.example .env
pnpm install
pnpm --filter @outreach-engine/db db:generate
pnpm --filter @outreach-engine/db db:migrate:dev
pnpm turbo dev
```

`apps/web` runs at `http://localhost:3000`; `apps/api` at `http://localhost:3001`. `apps/web` is no longer mock-data-only — nearly every screen calls the real API, so `apps/api` needs to actually be up (with a real `DATABASE_URL` and `REDIS_URL`) for anything beyond the login screen to render real content.

### Environment variables

See `.env.example` for the full list with inline descriptions. The ones that matter before anything else works: `DATABASE_URL` (Postgres), `REDIS_URL` (Upstash, required — BullMQ connects at module-load time), `BETTER_AUTH_SECRET` (required in production). `GOOGLE_PLACES_API_KEY` powers real discovery batches (`POST /batches`); `GROQ_API_KEY` powers real drafting by default (`LLM_PROVIDER=groq`); `ANTHROPIC_API_KEY` only matters if `LLM_PROVIDER=haiku`. `INSTANTLY_API_KEY` blank means sends persist as real `Send` rows marked `simulated: true` rather than dispatching a real email. `HUNTER_API_KEY` only matters when `ENRICHMENT_FALLBACK=hunter`. `META_APP_*` is unused (Instagram stays manual-send-only by design).

## Testing

`pnpm turbo test` runs every package's suite. On this Windows dev setup, running all packages' `vitest` workers fully in parallel can exhaust process/thread limits and crash with a spurious "Worker exited unexpectedly" — if that happens, `pnpm turbo test --concurrency=1` runs them serially and is reliable. This is an environment quirk, not a flaky test.

Current coverage:
- `packages/compliance-rules` — chokepoint aggregation (single-failure blocks all, every reason surfaces, not just the first)
- `packages/enrichment` — Hunter adapter (real HTTP calls, mocked at the `fetch` boundary) + factory selection
- `packages/llm-provider` — factory selection (`LLM_PROVIDER` default/override/garbage-value fallback), `GroqProvider`/`HaikuProvider` (real HTTP calls, mocked at the `fetch` boundary — note: the mocked `Response` needs an explicit `Content-Type: application/json` header or both SDKs silently fail to parse the body)
- `apps/api` — compliance-gated send (blocked vs. allowed), the single-Send-writer invariant (repo-wide source scan), Business-Line read isolation, Telegram approve/reject/regenerate-callback wiring + outbound broadcast notification (`grammy`'s `Bot` mocked at the SDK boundary, same convention as the LLM provider tests), the atomic lead-claim guard (`claim-lead.spec.ts` — conditional update succeeds/loses, correct "already handled" reason per terminal status), generated-password shape (length/charset/uniqueness), the rate-limited Redis error logger (dedup + cooldown + reset-on-new-message, using `vi.resetModules()` + fake timers since it keeps module-level state), `UsersService`'s validation/self-removal-guard/password-passthrough logic (BetterAuth's `getAuth()` mocked at the module boundary, same pattern as every other service test here), `HealthController`'s ok/degraded/timeout shapes

Every package with a `test` script needs at least one real test file — `vitest run` exits non-zero on "no test files found," which fails CI (this bit `packages/llm-provider` once already).

A DI token that points at a real constructed resource (e.g. `REDIS_CONNECTION` in `queues.module.ts`) should live in its own file, separate from the construction itself — otherwise importing just the token (e.g. to `@Inject()` it in a controller under test) transitively runs the real construction as a side effect. This bit `HealthController`'s own unit test: instantiating it opened a real Redis connection attempt during `vitest run`. See `redis-connection.token.ts`.
