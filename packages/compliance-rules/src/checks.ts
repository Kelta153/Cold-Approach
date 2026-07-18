import { prisma } from '@outreach-engine/db';
import type { SendCheckContext } from '@outreach-engine/types';

// Each check is independently unit-testable (Prisma is mocked in checks.test.ts, the same
// pattern used by apps/api's own service tests) and is run through the aggregator in
// chokepoint.ts, never called standalone by anything that writes a Send.

export async function checkEmailVerified(ctx: SendCheckContext): Promise<boolean> {
  const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId }, select: { emailStatus: true } });
  return lead?.emailStatus === 'valid';
}

export async function checkNotSuppressed(ctx: SendCheckContext): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: ctx.leadId },
    select: { email: true, business: { select: { googlePlaceId: true, instagramHandle: true } } },
  });
  if (!lead) return false;

  const domain = lead.email?.split('@')[1];
  const match = await prisma.suppressionEntry.findFirst({
    where: {
      businessLineId: ctx.businessLineId,
      OR: [
        lead.email ? { email: lead.email } : undefined,
        domain ? { domain } : undefined,
        lead.business?.googlePlaceId ? { googlePlaceId: lead.business.googlePlaceId } : undefined,
        lead.business?.instagramHandle ? { instagramHandle: lead.business.instagramHandle } : undefined,
      ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause)),
    },
    select: { id: true },
  });
  return !match;
}

export async function checkFooterPresent(ctx: SendCheckContext): Promise<boolean> {
  const line = await prisma.businessLine.findUnique({ where: { id: ctx.businessLineId }, select: { postalAddress: true } });
  return Boolean(line?.postalAddress && line.postalAddress.trim().length > 0);
}

export async function checkWarmupComplete(ctx: SendCheckContext): Promise<boolean> {
  const line = await prisma.businessLine.findUnique({ where: { id: ctx.businessLineId }, select: { warmupComplete: true } });
  return line?.warmupComplete === true;
}

export async function checkInboxCapNotExceeded(ctx: SendCheckContext): Promise<boolean> {
  const line = await prisma.businessLine.findUnique({ where: { id: ctx.businessLineId }, select: { sendLimits: true } });
  const perInboxPerDay = (line?.sendLimits as { perInboxPerDay?: number } | null)?.perInboxPerDay;
  if (typeof perInboxPerDay !== 'number') return true; // no configured cap — nothing to enforce

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sentToday = await prisma.send.count({
    where: { sendingInbox: ctx.sendingInbox, sentAt: { gte: startOfDay } },
  });
  return sentToday < perInboxPerDay;
}
