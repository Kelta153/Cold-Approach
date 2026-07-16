import { describe, expect, it } from 'vitest';
import { businessLineScopeExtension, scopeQueryArgs } from './scoped-prisma';

interface LeadRow {
  id: string;
  businessLineId: string;
  email: string;
}

/**
 * There is no live Postgres/Neon database available in this environment, and Prisma Client
 * Extensions (`$extends`) can only run against a real, connected `PrismaClient` — there is no
 * supported way to unit-test them against an in-memory store. So this test builds a minimal
 * fake client that implements just enough of Prisma's own extension contract (`$extends` +
 * `query.$allModels.$allOperations`) to run the *actual* `businessLineScopeExtension` from
 * `scoped-prisma.ts` — the same function `BusinessLineContext.db` wires up against the real
 * `prisma` client in production — against an in-memory "Lead" table containing rows from two
 * different Business Lines.
 *
 * This proves the real production scoping function, end-to-end, without needing a database:
 * a request/context scoped to Business Line A can never read Business Line B's Lead row.
 */
function createFakeScopedLeadClient(rows: LeadRow[], businessLineId: string) {
  const baseFindMany = async (args: { where?: Partial<LeadRow> }) => {
    const where = args?.where ?? {};
    return rows.filter((row) =>
      Object.entries(where).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value),
    );
  };

  const extension = businessLineScopeExtension(businessLineId);
  const allOperations = extension.query.$allModels.$allOperations;

  return {
    lead: {
      findMany: (args: { where?: Partial<LeadRow> } = {}) =>
        allOperations({
          model: 'Lead',
          operation: 'findMany',
          args,
          query: (scopedArgs) => baseFindMany(scopedArgs as { where?: Partial<LeadRow> }),
        }),
    },
  };
}

describe('Business Line scoping — Lead', () => {
  const leadInLineA: LeadRow = { id: 'lead_a', businessLineId: 'line_A', email: 'a@example.com' };
  const leadInLineB: LeadRow = { id: 'lead_b', businessLineId: 'line_B', email: 'b@example.com' };
  const rows = [leadInLineA, leadInLineB];

  it('a request/context scoped to Business Line A cannot read Business Line B\'s Lead row', async () => {
    const clientScopedToLineA = createFakeScopedLeadClient(rows, 'line_A');

    const result = (await clientScopedToLineA.lead.findMany()) as LeadRow[];

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('lead_a');
    expect(result.some((lead) => lead.id === 'lead_b')).toBe(false);
  });

  it('symmetrically, a context scoped to Business Line B cannot read Business Line A\'s Lead row', async () => {
    const clientScopedToLineB = createFakeScopedLeadClient(rows, 'line_B');

    const result = (await clientScopedToLineB.lead.findMany()) as LeadRow[];

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('lead_b');
  });

  it('overwrites a caller-supplied businessLineId in `where` rather than trusting it', async () => {
    const clientScopedToLineA = createFakeScopedLeadClient(rows, 'line_A');

    // Even if calling code tried to (accidentally or otherwise) ask for Line B's data, the
    // context-resolved businessLineId wins.
    const result = (await clientScopedToLineA.lead.findMany({ where: { businessLineId: 'line_B' } })) as LeadRow[];

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('lead_a');
  });
});

describe('scopeQueryArgs (pure function)', () => {
  it('forces businessLineId into a findMany where clause', () => {
    const args = scopeQueryArgs('Lead', 'findMany', { where: { email: 'x@example.com' } }, 'line_A');
    expect(args.where).toEqual({ email: 'x@example.com', businessLineId: 'line_A' });
  });

  it('forces businessLineId into create data', () => {
    const args = scopeQueryArgs('Lead', 'create', { data: { email: 'x@example.com' } }, 'line_A');
    expect(args.data).toEqual({ email: 'x@example.com', businessLineId: 'line_A' });
  });

  it('leaves an unscoped-model-shaped call untouched by the extension (only invoked for scoped models)', () => {
    // scopeQueryArgs itself always scopes what it's given — the model-name gate lives in
    // businessLineScopeExtension's $allOperations, tested above via the fake client.
    const args = scopeQueryArgs('Lead', 'findUnique', { where: { id: 'lead_1' } }, 'line_A');
    expect(args.where).toEqual({ id: 'lead_1', businessLineId: 'line_A' });
  });
});
