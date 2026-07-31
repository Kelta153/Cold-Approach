/** DI token for the shared Redis connection constructed in `queues.module.ts`. Lives in its own
 * file, separate from that module, specifically so anything that only needs the *token* (e.g.
 * `HealthController`) doesn't transitively trigger `queues.module.ts`'s top-level `new IORedis(...)`
 * — a real network connection attempt — as a side effect of importing it. This bit a unit test
 * directly: importing `HealthController` alone was enough to open a real Redis connection during
 * `vitest run`, which would attempt to connect to `redis://localhost:6379` in CI (no `REDIS_URL`
 * configured there) with every test run. */
export const REDIS_CONNECTION = 'REDIS_CONNECTION';
