// Mirrors the enums in packages/db/prisma/schema.prisma exactly — string literal unions
// instead of importing @prisma/client so apps/web can depend on this package without
// pulling in the generated Prisma client.

export type UserRole = 'admin' | 'operator';

export type LeadStatus =
  | 'discovered'
  | 'enriching'
  | 'drafted'
  | 'queued'
  | 'sent'
  | 'skipped'
  | 'rejected'
  | 'bounced'
  | 'replied';

export type LeadOutcome = 'none' | 'interested' | 'not_interested' | 'meeting_booked' | 'customer' | 'unsubscribed';

export type LeadChannel = 'email' | 'instagram_dm';

export type EmailStatus = 'unverified' | 'valid' | 'invalid' | 'not_found';

export type ContactMethod = 'email' | 'website_form';

export type BusinessSource = 'google_places' | 'instagram';

export type TemplateType = 'email_outbound' | 'email_reply' | 'instagram_dm';

export type SendStatus = 'sent' | 'bounced' | 'failed';

/** Who/what pressed send. The compliance chokepoint is the only path that writes a Send row,
 * regardless of which value this is — 'telegram' means the operator approved via the Telegram
 * bot's Approve button, not that the bot bypassed the chokepoint. */
export type ApprovedVia = 'webapp' | 'telegram';

export type ReplyClassification = 'interested' | 'question' | 'not_interested' | 'opt_out' | 'auto_reply' | 'complaint' | 'other';

export type SuppressionReason = 'unsubscribed' | 'bounced_hard' | 'manual_reject' | 'complaint';

export type BatchChannel = 'email' | 'instagram';
