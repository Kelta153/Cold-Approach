import { apiFetch } from '../api-client';

export interface TargetingProfileRaw {
  id: string;
  name: string;
  googlePlaceTypes: string[];
  keywords: string[];
  exclusions: string[];
  active: boolean;
}

export async function getTargetingProfiles(lineId: string): Promise<TargetingProfileRaw[]> {
  return apiFetch<TargetingProfileRaw[]>('/targeting-profiles', { businessLineId: lineId });
}

export interface CreateTargetingProfileInput {
  name: string;
  googlePlaceTypes: string[];
  keywords: string[];
  exclusions: string[];
}

export async function createTargetingProfile(lineId: string, input: CreateTargetingProfileInput): Promise<TargetingProfileRaw> {
  return apiFetch<TargetingProfileRaw>('/targeting-profiles', {
    method: 'POST',
    businessLineId: lineId,
    body: { ...input, active: true },
  });
}

export async function setTargetingProfileActive(lineId: string, id: string, active: boolean): Promise<void> {
  await apiFetch(`/targeting-profiles/${id}`, { method: 'PATCH', businessLineId: lineId, body: { active } });
}

export async function deleteTargetingProfile(lineId: string, id: string): Promise<void> {
  await apiFetch(`/targeting-profiles/${id}`, { method: 'DELETE', businessLineId: lineId });
}
