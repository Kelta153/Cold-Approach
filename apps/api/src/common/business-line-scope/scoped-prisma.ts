import type { PrismaClient } from '@outreach-engine/db';

/**
 * Every Prisma model that carries a `businessLineId` column, kept in sync with
 * `packages/db/prisma/schema.prisma`. If a new business-scoped model is added to the schema,
 * add its Prisma model name here too — nothing else needs to change, every query for it will
 * automatically be scoped.
 */
export const BUSINESS_LINE_SCOPED_MODELS = [
  'Product',
  'Template',
  'TargetingProfile',
  'Business',
  'Lead',
  'SuppressionEntry',
  'Batch',
] as const;

export type ScopedModelName = (typeof BUSINESS_LINE_SCOPED_MODELS)[number];

function isScopedModel(model: string | undefined): model is ScopedModelName {
  return !!model && (BUSINESS_LINE_SCOPED_MODELS as readonly string[]).includes(model);
}

/** Prisma operations that accept a `where` clause we can force businessLineId into. */
const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
  'upsert',
]);

type PrismaArgs = Record<string, unknown>;

/**
 * Pure function that rewrites a Prisma query's args to force `businessLineId`, so it can be
 * unit/integration-tested without a live database connection (Prisma Client Extensions can only
 * be exercised against a real, connected `PrismaClient`).
 *
 * This is intentionally an *overwrite*, not a merge-if-absent: even if a caller supplies its own
 * `businessLineId` in `where`/`data`, the context-resolved value always wins. That is the whole
 * point of the guardrail — a developer cannot override scoping by accident or on purpose.
 */
export function scopeQueryArgs(
  model: ScopedModelName,
  operation: string,
  args: PrismaArgs | undefined,
  businessLineId: string,
): PrismaArgs {
  const nextArgs: PrismaArgs = { ...(args ?? {}) };

  if (WHERE_OPERATIONS.has(operation)) {
    nextArgs.where = { ...((nextArgs.where as PrismaArgs) ?? {}), businessLineId };
  }

  if (operation === 'create') {
    nextArgs.data = { ...((nextArgs.data as PrismaArgs) ?? {}), businessLineId };
  }

  if (operation === 'createMany') {
    const data = nextArgs.data;
    nextArgs.data = Array.isArray(data) ? data.map((item) => ({ ...(item as PrismaArgs), businessLineId })) : data;
  }

  if (operation === 'upsert') {
    nextArgs.create = { ...((nextArgs.create as PrismaArgs) ?? {}), businessLineId };
  }

  void model; // reserved for future per-model overrides; every scoped model uses the same rule today
  return nextArgs;
}

/**
 * Prisma Client Extension: forces `businessLineId` into every query for every model in
 * `BUSINESS_LINE_SCOPED_MODELS`. This is the mechanism referenced in the module docstring — a
 * developer cannot forget to filter by business line because the client does it for them.
 */
export function businessLineScopeExtension(businessLineId: string) {
  return {
    name: 'business-line-scope',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: PrismaArgs;
          query: (args: PrismaArgs) => Promise<unknown>;
        }) {
          if (!isScopedModel(model)) {
            return query(args);
          }
          return query(scopeQueryArgs(model, operation, args, businessLineId));
        },
      },
    },
  };
}

/** Returns a Prisma client that transparently scopes every query for every business-line-scoped
 * model to `businessLineId`. Services should query through this, never the raw `prisma` export. */
export function createScopedPrismaClient(client: PrismaClient, businessLineId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).$extends(businessLineScopeExtension(businessLineId)) as PrismaClient;
}
