import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { BatchDto } from '@outreach-engine/types';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';
import type { BatchStats } from './batch-stats';

/** Read side for the Batches admin screen — maps the real `Batch` row + its `stats` Json blob
 * into the display-shaped `BatchDto` the frontend already expects. */
@Injectable()
export class BatchesService {
  constructor(@Inject(BusinessLineContext) private readonly businessLineContext: BusinessLineContext) {}

  async findAll(): Promise<BatchDto[]> {
    const batches = await this.businessLineContext.db.batch.findMany({
      include: { profile: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return batches.map(toBatchDto);
  }

  async findOne(id: string): Promise<BatchDto> {
    const batch = await this.businessLineContext.db.batch.findFirst({
      where: { id },
      include: { profile: { select: { name: true } } },
    });
    if (!batch) throw new NotFoundException(`Batch ${id} not found in this business line.`);
    return toBatchDto(batch);
  }
}

function toBatchDto(batch: { id: string; createdAt: Date; profile: { name: string }; channel: string; stats: unknown }): BatchDto {
  // Older, hand-seeded demo batches (see packages/db/src/seed.ts) don't carry this exact shape —
  // fall back to 0/'complete' rather than rendering "undefined" in the admin UI.
  const raw = batch.stats as Partial<BatchStats> | null;
  const stats: BatchStats = {
    status: raw?.status ?? 'complete',
    totalLeads: raw?.totalLeads ?? null,
    discovered: raw?.discovered ?? 0,
    enriched: raw?.enriched ?? 0,
    drafted: raw?.drafted ?? 0,
    failed: raw?.failed ?? 0,
    placesCalls: raw?.placesCalls ?? 0,
    anthropicCalls: raw?.anthropicCalls ?? 0,
  };
  return {
    id: batch.id,
    date: batch.createdAt.toISOString().slice(0, 10),
    profile: batch.profile.name,
    channel: batch.channel as BatchDto['channel'],
    funnelLabel: `${stats.discovered} → ${stats.enriched} → ${stats.drafted} → –`,
    apiSpendLabel: `${stats.placesCalls} Places · ${stats.anthropicCalls} Claude`,
    status: stats.status,
  };
}
