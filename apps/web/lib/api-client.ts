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
    // Every screen here re-fetches right after a create/update/delete on the same page (no
    // navigation in between) — without this, the browser's HTTP cache can silently serve the
    // pre-mutation response for the identical GET URL, making a successful write look like it
    // did nothing until the next full page load.
    cache: 'no-store',
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
