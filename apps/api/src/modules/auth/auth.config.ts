/**
 * BetterAuth (`better-auth` and `@better-auth/prisma-adapter`) ship ESM-only ("type": "module",
 * no CJS build/`require` export condition). `apps/api` otherwise compiles to CommonJS to match
 * the rest of this monorepo's tooling (plain `tsc`, no bundler). A CommonJS file cannot
 * statically `import`/`require` an ESM-only package, so every touch point here uses a dynamic
 * `import()` — the standard, TypeScript/Node-sanctioned way for a CJS module to consume an
 * ESM-only dependency — instead of a static `import ... from 'better-auth'`. Everything is
 * memoized so we only pay the dynamic-import cost once per process.
 */
import { prisma } from '@outreach-engine/db';

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
  const [{ betterAuth }, { prismaAdapter }] = await Promise.all([
    import('better-auth'),
    import('@better-auth/prisma-adapter'),
  ]);

  // BetterAuth owns `User`/`Session`/`Account`/`Verification` via its Prisma adapter, pointed at
  // the same Postgres database as every other domain model. `User` is extended (not replaced)
  // with the columns BetterAuth's adapter requires — see schema.prisma — so `role` and
  // `telegramUserId` stay real, joinable domain columns rather than living in a second,
  // disconnected identity store. `role` additionally rides on the session as a BetterAuth
  // `additionalField` so `RolesGuard` can read it without an extra query.
  return betterAuth({
    secret: resolveAuthSecret(),
    baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
    // apps/web runs on a different origin/port — cookies and CSRF checks need it allow-listed.
    trustedOrigins: (process.env.WEB_APP_URL ?? 'http://localhost:3000').split(','),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
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
