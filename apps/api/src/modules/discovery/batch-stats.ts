import { prisma } from '@outreach-engine/db';

/** Shape persisted in `Batch.stats` (a Json column — see schema.prisma). Funnel counts plus a
 * cheap API-call tally; no schema relation exists from Lead back to Batch, so every pipeline
 * stage that touches a batch-originated lead reports back here explicitly. */
export interface BatchStats {
  status: 'discovering' | 'enriching' | 'drafting' | 'complete' | 'failed';
  totalLeads: number | null; // null until discovery finishes enqueueing
  discovered: number;
  enriched: number;
  drafted: number;
  failed: number;
  placesCalls: number;
  anthropicCalls: number;
}

export function initialBatchStats(): BatchStats {
  return {
    status: 'discovering',
    totalLeads: null,
    discovered: 0,
    enriched: 0,
    drafted: 0,
    failed: 0,
    placesCalls: 0,
    anthropicCalls: 0,
  };
}

/** Read-modify-write against the current row. Good enough at this batch's scale (single-digit to
 * low-double-digit leads, one BullMQ worker per queue) — not a general-purpose atomic counter. */
export async function updateBatchStats(batchId: string, mutate: (stats: BatchStats) => void): Promise<BatchStats> {
  const batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
  const stats = batch.stats as unknown as BatchStats;
  mutate(stats);

  if (stats.totalLeads != null && stats.drafted + stats.failed >= stats.totalLeads && stats.status !== 'failed') {
    stats.status = 'complete';
  }

  await prisma.batch.update({ where: { id: batchId }, data: { stats: stats as unknown as object } });
  return stats;
}
