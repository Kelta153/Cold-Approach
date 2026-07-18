const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ApiFetchOptions {
  method?: string;
  businessLineId?: string;
  body?: unknown;
}

/** Every real call to apps/api goes through this — `credentials: 'include'` so the BetterAuth
 * session cookie rides along cross-origin, and `X-Business-Line-Id` so every business-scoped
 * route is automatically scoped server-side (see apps/api's BusinessLineContext). */
export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.businessLineId ? { 'X-Business-Line-Id': opts.businessLineId } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${opts.method ?? 'GET'} ${path} failed: ${res.status} ${text}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
