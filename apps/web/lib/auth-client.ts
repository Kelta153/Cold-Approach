import { createAuthClient } from 'better-auth/client';

/** Talks to apps/api's real BetterAuth instance — sessions are real cookies, role comes from
 * the server, not a client-side mock. `credentials: 'include'` is required since apps/web and
 * apps/api are different origins (different ports) even in local dev. */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  fetchOptions: {
    credentials: 'include',
  },
});
