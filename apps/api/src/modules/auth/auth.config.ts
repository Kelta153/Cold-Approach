/**
 * BetterAuth (`better-auth` and `@better-auth/memory-adapter`) ship ESM-only ("type": "module",
 * no CJS build/`require` export condition). `apps/api` otherwise compiles to CommonJS to match
 * the rest of this monorepo's tooling (plain `tsc`, no bundler). A CommonJS file cannot
 * statically `import`/`require` an ESM-only package, so every touch point here uses a dynamic
 * `import()` — the standard, TypeScript/Node-sanctioned way for a CJS module to consume an
 * ESM-only dependency — instead of a static `import ... from 'better-auth'`. Everything is
 * memoized so we only pay the dynamic-import cost once per process.
 */

// Type-only reference: safe regardless of the ESM/CJS mismatch, erased at compile time.
type NodeIntegrationModule = typeof import('better-auth/node');

/**
 * `BETTER_AUTH_SECRET` signs every session token — a known value means anyone can forge a
 * session. Production must set it explicitly; a fallback there would mean the app boots with a
 * secret published in this very file. Non-production environments (local dev, CI, tests) get a
 * fixed insecure fallback purely for run-without-a-`.env` convenience.
 */
function resolveAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET must be set in production — refusing to start with no session-signing secret.');
  }
  return 'dev-only-insecure-secret-change-me';
}

async function buildAuth() {
  const [{ betterAuth }, { memoryAdapter }] = await Promise.all([
    import('better-auth'),
    import('@better-auth/memory-adapter'),
  ]);

  // Judgment call: BetterAuth normally owns its own `user`/`session`/`account`/`verification`
  // tables via a Prisma/SQL adapter. `packages/db/prisma/schema.prisma` is locked verbatim for
  // this phase and its `User` model is intentionally minimal (id, email, role, telegramUserId) —
  // no password hash or session columns — and we were told not to alter its entity structure.
  // Rather than bolt BetterAuth-owned columns onto the locked schema, this uses BetterAuth's
  // official in-memory adapter as its own identity store for Phase 1. `role` is modelled as a
  // BetterAuth `additionalField` so sessions carry it directly (see `RolesGuard`). This keeps
  // auth fully wired (real sign-up/sign-in, real sessions, real role-gated routes) without
  // touching the domain schema. A persistent adapter is a Phase 4 concern.
  return betterAuth({
    secret: resolveAuthSecret(),
    database: memoryAdapter({}),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'operator',
          // Not settable from the public sign-up payload — promoting a user to `admin` is an
          // out-of-band operation in this phase, there is no self-serve admin escalation route.
          input: false,
        },
      },
    },
  });
}

/** Derived directly from `buildAuth`'s own inferred return type (rather than independently
 * instantiating `betterAuth`'s generic elsewhere), so it can never structurally diverge from
 * what `buildAuth` actually returns. */
export type Auth = Awaited<ReturnType<typeof buildAuth>>;

let authPromise: ReturnType<typeof buildAuth> | undefined;
let nodeIntegrationPromise: Promise<NodeIntegrationModule> | undefined;

/** The shared BetterAuth instance, built once and cached. */
export function getAuth(): ReturnType<typeof buildAuth> {
  if (!authPromise) {
    authPromise = buildAuth();
  }
  return authPromise;
}

/** `toNodeHandler` (mounted on the raw Express app in `main.ts`) and `fromNodeHeaders` (used by
 * `RolesGuard` to read the session for a Node/Express request), both from `better-auth/node`. */
export function getNodeIntegration(): Promise<NodeIntegrationModule> {
  if (!nodeIntegrationPromise) {
    nodeIntegrationPromise = import('better-auth/node');
  }
  return nodeIntegrationPromise;
}
