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
```

## Data model

`packages/db/prisma/schema.prisma` is the single source of truth for the domain. The shape that matters most:

- **`BusinessLine`** — the tenant. Everything below is scoped to one.
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

1. **No send bypasses the compliance chokepoint.** `packages/compliance-rules`'s `runComplianceChokepoint` runs five checks — email verified, not suppressed, compliance footer present, sending inbox warmed up, inbox daily cap not exceeded — and returns *every* failing reason, not just the first. `apps/api`'s `sending.attemptSend(draftId, approvedByUserId, approvedVia)` is the only function allowed to write a `Send` row, and it always calls the chokepoint first. This holds regardless of who approved the send: the webapp's Send button and the Telegram bot's Approve callback both call this exact method, differing only in `approvedVia`. There is no second path — a repo-wide test (`send-write-path.spec.ts`) scans the source tree and fails if a second `prisma.send.create` call site ever appears.
2. **No code path sends an Instagram DM automatically.** Instagram is manual-send only: the operator copies the drafted message and sends it themselves in the Instagram app; `DmSend` only logs that it happened.
3. **Every business-scoped query is scoped, automatically.** `apps/api`'s `common/business-line-scope` resolves the active Business Line from the `X-Business-Line-Id` request header via a request-scoped `BusinessLineContext`, and hands services a Prisma client wrapped in a Client Extension that force-injects `businessLineId` into every query for every scoped model. A developer calling `businessLineContext.db.lead.findMany()` cannot forget the filter or override it with a different id — the extension always wins.

## Compliance chokepoint, in detail

`packages/compliance-rules` defines five checks (`checkEmailVerified`, `checkNotSuppressed`, `checkFooterPresent`, `checkWarmupComplete`, `checkInboxCapNotExceeded`) and `runComplianceChokepoint(ctx, checks?)`, which runs all five and aggregates `{ allowed, blockedReasons[] }`. Today every check is stubbed to `return true` (real DB-backed logic is a later phase) — the aggregator, the "any one failure blocks everything" behavior, and the "surface every reason" behavior are real and unit-tested now, independent of the checks' internals.

`apps/api`'s `compliance` module wraps this for the rest of the app; `sending.attemptSend` is the only caller that matters — see Guardrail 1.

## Enrichment

`packages/enrichment` defines `EmailFinder`/`EmailVerifier` interfaces. Two implementations exist:

- **`WebsiteScraperFinder` / `MxRecordVerifier`** — free, no external API, active by default.
- **`HunterFinder` / `HunterVerifier`** — real calls against Hunter.io's `domain-search` and `email-verifier` endpoints, fully implemented but **inactive by default**.

`createEnrichmentAdapters()` is the only entry point anything should call. It reads `ENRICHMENT_FALLBACK` (`"none"` default, or `"hunter"`) — when set to `"hunter"`, Hunter is wrapped in as a fallback that's tried only when the free method comes back empty, not a full replacement. No other code should know or care which implementation is active.

## Business Line scoping

- `BusinessLineContext` (request-scoped) resolves the active line from `X-Business-Line-Id` and exposes `.db`, a Prisma client scoped to it.
- `scoped-prisma.ts` defines the extension: it force-overwrites `businessLineId` in the `where`/`data`/`create` args of every operation against every model listed in `BUSINESS_LINE_SCOPED_MODELS`, even if a caller supplied its own value.
- Services depend on `BusinessLineContext`, never the raw `prisma` export, for anything business-scoped.

## Backend (`apps/api`)

NestJS, TypeScript, CommonJS. Boots on `PORT` (default `3001`), health check at `GET /health`.

Module map:

| Module | Status | Notes |
|---|---|---|
| `business-lines`, `catalogue`, `targeting`, `suppression` | Real CRUD | Scoped via `BusinessLineContext` |
| `compliance` | Real | Wraps the chokepoint |
| `sending` | Real | The sole `Send`-writer (`attemptSend`) |
| `auth` | Real | BetterAuth, email+password, `admin`/`operator` roles |
| `discovery`, `drafting`, `replies` | Stub | Scaffolded, no pipeline logic yet |
| `enrichment` | Partial | Real adapter wiring, stub call sites |
| `instagram` | Stub | Deliberately has no send capability — see Guardrail 2 |
| `notifications` | Scaffold | `POST /telegram/webhook`, secret-verified; Approve/Reject/Regenerate wiring to `attemptSend` is a later phase |

**Auth**: BetterAuth mounted at `/api/auth/*` directly on the underlying Express instance (its handler needs the raw request body, so Nest's body parser is disabled and re-applied manually for every other route). Because the locked schema's `User` model has no password/session columns, BetterAuth's official in-memory adapter is its own identity store for this phase — a persistent adapter is later work. `role` rides on the session as a BetterAuth `additionalField`, read by `RolesGuard`/`@Roles()` to gate admin-only routes. `BETTER_AUTH_SECRET` must be set in production; the app throws on boot if it's missing there (a fixed insecure fallback exists only for local dev/test).

**Queues**: BullMQ (`@nestjs/bullmq`) with three placeholder queues — `discovery`, `enrichment`, `drafting` — each with a stub processor that logs and completes. Real job payloads/logic land with the corresponding module's real implementation.

## Frontend (`apps/web`)

Next.js App Router + Tailwind, IBM Plex Sans/Mono. Dark theme by default; light theme is a real CSS-variable override (`app/globals.css`), not a filter.

- **Routes**: `/login`, `/review`, `/replies`, `/instagram`, `/admin/lines`, `/admin/catalogue` (tabs: catalogue | templates | targeting), `/admin/batches`. Role gating happens in `app/(app)/layout.tsx` — operators are redirected out of `/admin/*`.
- **State**: `lib/state/app-state.tsx` is a single client context holding session, theme, active Business Line (+ the 650ms skeleton on switch), all three queues' items/selections/decisions/drafts, and the admin screens' local state. It's the React equivalent of the original design prototype's single-component state — same behavior, idiomatic implementation.
- **Data layer**: `lib/mock-data.ts` holds fixtures shaped to match `packages/types` DTOs (which mirror the Prisma schema/enums — not the original design mockups' ad hoc field names). `lib/data/*.ts` wraps them in `async` functions with the same signature a real `fetch` call would have, so swapping in the real API later doesn't touch any component.
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

`apps/web` runs at `http://localhost:3000`; `apps/api` at `http://localhost:3001`. `apps/web` currently runs entirely on mock data — no `DATABASE_URL` needed to click through it. `apps/api` needs a real Postgres (`DATABASE_URL`) to boot its Prisma-backed routes.

### Environment variables

See `.env.example` for the full list with inline descriptions. The ones that matter before anything else works: `DATABASE_URL` (Postgres), `BETTER_AUTH_SECRET` (required in production). Everything else (`REDIS_URL`, `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`, `INSTANTLY_API_KEY`, `TELEGRAM_BOT_TOKEN`, `HUNTER_API_KEY`, `META_APP_*`) backs a specific module and is only needed once that module's real implementation lands.

## Testing

`pnpm turbo test` runs every package's suite. On this Windows dev setup, running all packages' `vitest` workers fully in parallel can exhaust process/thread limits and crash with a spurious "Worker exited unexpectedly" — if that happens, `pnpm turbo test --concurrency=1` runs them serially and is reliable. This is an environment quirk, not a flaky test.

Current coverage:
- `packages/compliance-rules` — chokepoint aggregation (single-failure blocks all, every reason surfaces, not just the first)
- `packages/enrichment` — Hunter adapter (real HTTP calls, mocked at the `fetch` boundary) + factory selection
- `apps/api` — compliance-gated send (blocked vs. allowed), the single-Send-writer invariant (repo-wide source scan), Business-Line read isolation
