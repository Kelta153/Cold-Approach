import type { BatchDto, CatalogueRowDto, TargetingRowDto, TemplateDto } from '@outreach-engine/types';
import { batches, batchStats, catalogue, targeting, templates } from '../mock-data';

export async function getCatalogue(_lineId: string): Promise<CatalogueRowDto[]> {
  return catalogue;
}

export async function getTargeting(_lineId: string): Promise<TargetingRowDto[]> {
  return targeting;
}

export async function getTemplates(_lineId: string): Promise<TemplateDto[]> {
  return templates;
}

export async function getBatches(_lineId: string): Promise<{ stats: typeof batchStats; rows: BatchDto[] }> {
  return { stats: batchStats, rows: batches };
}
