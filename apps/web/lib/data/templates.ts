import type { TemplateDto } from '@outreach-engine/types';
import { apiFetch } from '../api-client';

export async function getTemplates(lineId: string): Promise<TemplateDto[]> {
  return apiFetch<TemplateDto[]>('/templates', { businessLineId: lineId });
}

export interface CreateTemplateInput {
  type: TemplateDto['type'];
  subjectSkeleton: string | null;
  bodySkeleton: string;
}

export async function createTemplate(lineId: string, input: CreateTemplateInput): Promise<TemplateDto> {
  return apiFetch<TemplateDto>('/templates', { method: 'POST', businessLineId: lineId, body: { ...input, active: true } });
}

export async function updateTemplate(lineId: string, id: string, patch: { subjectSkeleton?: string | null; bodySkeleton?: string }): Promise<TemplateDto> {
  return apiFetch<TemplateDto>(`/templates/${id}`, { method: 'PATCH', businessLineId: lineId, body: patch });
}

export async function deleteTemplate(lineId: string, id: string): Promise<void> {
  await apiFetch(`/templates/${id}`, { method: 'DELETE', businessLineId: lineId });
}
