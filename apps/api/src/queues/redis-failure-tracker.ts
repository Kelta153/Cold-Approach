import { prisma } from '@outreach-engine/db';

const FAILURE_THRESHOLD = 2;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let consecutiveFailures = 0;

/**
 * The Fly trial tier force-kills this process every 5 minutes, which re-establishes the shared
 * Redis connection and re-registers all 3 BullMQ queues from scratch on every restart — itself a
 * real, recurring command cost against Upstash's metered quota, on top of whatever job traffic is
 * happening. `redis-error-logger.ts` only rate-limits *log lines* for a sustained failure; nothing
 * stops manual batch triggering from queuing more work against a Redis that's already known-bad.
 *
 * This tracks consecutive failures in memory (resets on every restart, same as the logger's own
 * dedup state — fine, since a real sustained outage re-accumulates failures fast within any
 * 5-minute window) and, once `FAILURE_THRESHOLD` is reached, writes a 7-day cooldown into every
 * `BusinessLine`'s `AutomationState` row — a real Postgres write, done once per cooldown
 * activation, not on every subsequent error, and never stomping/extending an already-active
 * cooldown. Unlike the logger, this state must survive process restarts (see the file-level
 * comment above about the 5-minute kill), which is why it lives in the database rather than
 * in-memory. Only an admin clearing it (see `BatchesController`) ends a cooldown early — a
 * successful Redis command does not auto-clear it, by design.
 */
export async function recordRedisFailureAndMaybeStartCooldown(_err: Error): Promise<void> {
  consecutiveFailures += 1;
  if (consecutiveFailures < FAILURE_THRESHOLD) {
    return;
  }

  const businessLines = await prisma.businessLine.findMany({ select: { id: true } });
  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + COOLDOWN_MS);

  await Promise.all(
    businessLines.map(async ({ id: businessLineId }) => {
      const existing = await prisma.automationState.findUnique({ where: { businessLineId } });
      const alreadyActive = existing?.redisCooldownUntil != null && existing.redisCooldownUntil > now;
      if (alreadyActive) {
        return;
      }

      await prisma.automationState.upsert({
        where: { businessLineId },
        create: { businessLineId, redisFailureCount: consecutiveFailures, redisCooldownUntil: cooldownUntil },
        update: { redisFailureCount: consecutiveFailures, redisCooldownUntil: cooldownUntil },
      });
    }),
  );
}
