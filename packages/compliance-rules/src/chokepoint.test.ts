import { describe, expect, it } from 'vitest';
import { DEFAULT_CHECKS, runComplianceChokepoint, type ChokepointCheck } from './chokepoint';

const CTX = { leadId: 'lead_1', businessLineId: 'line_1', sendingInbox: 'kay@auroraskin.co' };

const passing = (reason: string): ChokepointCheck => ({ reason, run: async () => true });
const failing = (reason: string): ChokepointCheck => ({ reason, run: async () => false });

describe('runComplianceChokepoint', () => {
  it('allows the send when all five checks pass', async () => {
    const result = await runComplianceChokepoint(CTX, DEFAULT_CHECKS);
    expect(result.allowed).toBe(true);
    expect(result.blockedReasons).toEqual([]);
  });

  it('blocks the whole send when a single check fails', async () => {
    const checks = [passing('a'), passing('b'), failing('warm-up not complete'), passing('d'), passing('e')];
    const result = await runComplianceChokepoint(CTX, checks);
    expect(result.allowed).toBe(false);
  });

  it('surfaces the failing reason rather than swallowing it', async () => {
    const checks = [passing('a'), failing('warm-up not complete'), passing('c')];
    const result = await runComplianceChokepoint(CTX, checks);
    expect(result.blockedReasons).toContain('warm-up not complete');
  });

  it('returns every failing reason, not just the first', async () => {
    const checks = [failing('reason A'), passing('b'), failing('reason C'), failing('reason D')];
    const result = await runComplianceChokepoint(CTX, checks);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toEqual(['reason A', 'reason C', 'reason D']);
  });
});
