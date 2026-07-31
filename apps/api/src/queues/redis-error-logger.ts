import { Logger } from '@nestjs/common';

const LOG_COOLDOWN_MS = 60_000;

let lastMessage: string | null = null;
let lastLoggedAt = 0;
let suppressedCount = 0;

/**
 * A sustained Redis failure (e.g. Upstash's monthly command quota being exhausted) fires
 * repeatedly on every poll/retry — without this, a single ongoing failure floods the log
 * (17,000+ identical lines observed in one session) and burns disk space for no benefit. Logs the
 * first occurrence of a message immediately, then at most once per LOG_COOLDOWN_MS while the same
 * message keeps recurring, reporting how many were suppressed in between.
 */
export function logRedisErrorOnce(logger: Logger, err: Error): void {
  const message = err.message;
  const now = Date.now();

  if (message !== lastMessage) {
    lastMessage = message;
    lastLoggedAt = now;
    suppressedCount = 0;
    logger.error(`Redis error: ${message}`);
    return;
  }

  suppressedCount += 1;
  if (now - lastLoggedAt >= LOG_COOLDOWN_MS) {
    logger.error(`Redis error (still occurring — ${suppressedCount} more since last log): ${message}`);
    lastLoggedAt = now;
    suppressedCount = 0;
  }
}
