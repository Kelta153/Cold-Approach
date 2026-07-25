import type {
  ApprovedVia,
  BatchChannel,
  EmailStatus,
  LeadChannel,
  ReplyClassification,
  TemplateType,
} from './enums';

export interface BusinessLineDto {
  id: string;
  name: string;
  senderName: string;
  companyLegalName: string;
  postalAddress: string | null;
  sendingDomain: string;
  sendingInboxes: { email: string; dailyCap: number; active: boolean }[];
  privacyPolicyUrl: string | null;
  channelsEnabled: { email: boolean; instagram: boolean };
  sendLimits: { perInboxPerDay: number; igPerDay: number; rampSchedule: unknown[] };
  warmupComplete: boolean;
  active: boolean;
}

/** Present on any decided (sent) queue item, in both the API response and the mock fixtures —
 * this is not backend-only bookkeeping. Mirrors Send.approvedVia / Send.approvedByUserId. */
export interface SendAuditDto {
  approvedVia: ApprovedVia;
  approvedByUserId: string;
  sentAt: string;
  /** True when no INSTANTLY_API_KEY was configured at send time — the Send row is real, but no
   * email actually left a mailbox. Must stay visible to the operator, never silently equivalent
   * to a real send. */
  simulated: boolean;
}

export interface FactDto {
  text: string;
  source: string;
}

export interface ReviewQueueItemDto {
  id: string; // Draft id
  leadId: string;
  businessLineId: string;
  company: string;
  contact: string;
  title: string;
  email: string;
  emailStatus: EmailStatus;
  domain: string;
  city: string;
  segment: string;
  channel: LeadChannel;
  facts: FactDto[];
  subject: string;
  body: string;
  /** Empty when the send is allowed; every failing compliance-chokepoint reason otherwise. */
  blockedReasons: string[];
  send?: SendAuditDto;
}

export interface ReplyQueueItemDto {
  id: string; // Reply id
  leadId: string;
  businessLineId: string;
  contact: string;
  company: string;
  classification: ReplyClassification;
  original: string;
  reply: string;
  draft: string;
  inbox: string;
  receivedAt: string;
  sentAt: string;
  send?: SendAuditDto;
}

export interface DmQueueItemDto {
  id: string; // DmDraft id
  leadId: string;
  businessLineId: string;
  handle: string;
  name: string;
  followers: string;
  posts: string;
  bio: string;
  draft: string;
  /** DM sends are manual-only (no chokepoint, no Telegram gating) — always operator-logged. */
  markedSentByUserId?: string;
}

export interface TemplateDto {
  id: string;
  businessLineId: string;
  type: TemplateType;
  subjectSkeleton: string | null;
  bodySkeleton: string;
  active: boolean;
  createdAt: string;
}

export interface CatalogueRowDto {
  sku: string;
  name: string;
  priceLabel: string;
  moq: number;
  active: boolean;
}

export interface TargetingRowDto {
  name: string;
  description: string;
  geography: string;
  channel: LeadChannel | 'email + instagram_dm';
  prospectsFound: number;
  active: boolean;
}

export interface BatchDto {
  id: string;
  date: string;
  profile: string;
  channel: BatchChannel;
  funnelLabel: string;
  apiSpendLabel: string;
  status: 'discovering' | 'enriching' | 'drafting' | 'complete' | 'failed';
}

export interface CreateBatchDto {
  profileId: string;
  productId: string;
  geography: string;
  sizeRequested: number;
}
