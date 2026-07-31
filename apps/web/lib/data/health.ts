import { apiFetch } from '../api-client';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  redis: { ok: boolean; error?: string };
}

export async function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}
