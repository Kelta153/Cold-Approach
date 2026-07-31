import type { BatchDto, CreateBatchDto } from '@outreach-engine/types';
import { apiFetch } from '../api-client';

export interface TargetingProfileOption {
  id: string;
  name: string;
  active: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  active: boolean;
}

export async function getBatches(lineId: string): Promise<BatchDto[]> {
  return apiFetch<BatchDto[]>('/batches', { businessLineId: lineId });
}

/** Real /targeting-profiles read, reused here only to populate the Run-batch form's dropdown
 * (the Targeting admin screen itself also reads this same real endpoint — see lib/data/targeting.ts). */
export async function getTargetingProfileOptions(lineId: string): Promise<TargetingProfileOption[]> {
  return apiFetch<TargetingProfileOption[]>('/targeting-profiles', { businessLineId: lineId });
}

/** Real /catalogue/products read, reused here only to populate the Run-batch form's dropdown
 * (the Catalogue admin screen itself also reads this same real endpoint — see lib/data/catalogue.ts). */
export async function getProductOptions(lineId: string): Promise<ProductOption[]> {
  return apiFetch<ProductOption[]>('/catalogue/products', { businessLineId: lineId });
}

export async function runBatch(lineId: string, dto: CreateBatchDto): Promise<{ batchId: string }> {
  return apiFetch<{ batchId: string }>('/batches', { method: 'POST', businessLineId: lineId, body: dto });
}
