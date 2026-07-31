import { apiFetch } from '../api-client';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  // `stale: true` means this is a cached result from apps/api's Redis-health circuit breaker
  // (it skipped a real ping to avoid hammering a metered Redis plan mid-outage), not a fresh check.
  redis: { ok: boolean; error?: string; stale?: boolean };
}

export async function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}
