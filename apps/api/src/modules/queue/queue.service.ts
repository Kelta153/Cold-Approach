import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@outreach-engine/db';
import type { DmQueueItemDto, ReplyQueueItemDto, ReviewQueueItemDto, SendCheckContext } from '@outreach-engine/types';
import { pickSendingInbox } from '../../common/pick-sending-inbox';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';
import { ComplianceService } from '../compliance/compliance.service';

/**
 * Read side of the operator queues, and the plain (non-compliance-gated) lead-state actions —
 * Skip/Reject/Mark-handled. Sending itself only ever goes through `SendingService.attemptSend`
 * (see modules/sending) — this service never writes a `Send` row.
 */
@Injectable()
export class QueueService {
  constructor(
    @Inject(BusinessLineContext) private readonly businessLineContext: BusinessLineContext,
    @Inject(ComplianceService) private readonly compliance: ComplianceService,
  ) {}

  async getReviewQueue(): Promise<ReviewQueueItemDto[]> {
    const businessLineId = this.businessLineContext.getBusinessLineId();
    const leads = await this.businessLineContext.db.lead.findMany({
      where: { channel: 'email', drafts: { some: {} } },
      include: {
        business: true,
        drafts: { orderBy: { version: 'desc' }, take: 1 },
        sends: { orderBy: { sentAt: 'desc' }, take: 1 },
        businessLine: { select: { sendingInboxes: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      leads
        .filter((lead) => lead.drafts.length > 0)
        .map(async (lead) => {
          const draft = lead.drafts[0];
          const send = lead.sends[0];

          const ctx: SendCheckContext = {
            leadId: lead.id,
            businessLineId,
            sendingInbox: pickSendingInbox(lead.businessLine.sendingInboxes),
          };
          const blockedReasons = send ? [] : (await this.compliance.runChokepoint(ctx)).blockedReasons;

          return {
            id: draft.id,
            leadId: lead.id,
            businessLineId,
            company: lead.business.name,
            contact: lead.contactFirstName ?? '',
            title: '',
            email: lead.email ?? '',
            emailStatus: lead.emailStatus,
            domain: lead.business.website ?? '',
            city: lead.business.address ?? '',
            segment: lead.business.category ?? '',
            channel: lead.channel,
            facts: (draft.groundingFacts as { text: string; source: string }[] | null) ?? [],
            subject: draft.subject,
            body: draft.body,
            blockedReasons,
            send: send
              ? { approvedVia: send.approvedVia as 'webapp' | 'telegram', approvedByUserId: send.approvedByUserId, sentAt: send.sentAt.toISOString(), simulated: send.simulated }
              : undefined,
          } satisfies ReviewQueueItemDto;
        }),
    );
  }

  async getReplyQueue(): Promise<ReplyQueueItemDto[]> {
    const businessLineId = this.businessLineContext.getBusinessLineId();
    const leads = await this.businessLineContext.db.lead.findMany({
      where: { replies: { some: {} } },
      include: {
        business: true,
        replies: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
          include: { replyDrafts: { orderBy: { version: 'desc' }, take: 1 }, send: { include: { draft: true } } },
        },
      },
    });

    return leads
      .filter((lead) => lead.replies.length > 0)
      .map((lead) => {
        const reply = lead.replies[0];
        const replyDraft = reply.replyDrafts[0];
        return {
          id: reply.id,
          leadId: lead.id,
          businessLineId,
          contact: lead.contactFirstName ?? reply.fromEmail,
          company: lead.business.name,
          classification: reply.classification,
          original: reply.send?.draft?.body ?? '',
          reply: reply.body,
          draft: replyDraft?.body ?? '',
          inbox: reply.send?.sendingInbox ?? '',
          receivedAt: reply.receivedAt.toISOString(),
          sentAt: reply.send?.sentAt.toISOString() ?? reply.receivedAt.toISOString(),
        } satisfies ReplyQueueItemDto;
      });
  }

  async getDmQueue(): Promise<DmQueueItemDto[]> {
    const businessLineId = this.businessLineContext.getBusinessLineId();
    const leads = await this.businessLineContext.db.lead.findMany({
      where: { channel: 'instagram_dm', dmDrafts: { some: {} } },
      include: { business: true, dmDrafts: { orderBy: { version: 'desc' }, take: 1 } },
    });

    return leads
      .filter((lead) => lead.dmDrafts.length > 0)
      .map((lead) => {
        const draft = lead.dmDrafts[0];
        return {
          id: draft.id,
          leadId: lead.id,
          businessLineId,
          handle: lead.business.instagramHandle ?? '',
          name: lead.business.name,
          followers: lead.business.instagramFollowers != null ? String(lead.business.instagramFollowers) : '',
          posts: '',
          bio: lead.business.instagramBio ?? '',
          draft: draft.body,
        } satisfies DmQueueItemDto;
      });
  }

  async skipLead(leadId: string): Promise<void> {
    await this.assertLeadInScope(leadId);
    await this.businessLineContext.db.lead.update({ where: { id: leadId }, data: { status: 'skipped' } });
  }

  async rejectLead(leadId: string): Promise<void> {
    const lead = await this.assertLeadInScope(leadId);
    const businessLineId = this.businessLineContext.getBusinessLineId();

    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data: { status: 'rejected' } }),
      prisma.suppressionEntry.create({
        data: {
          businessLineId,
          email: lead.email ?? undefined,
          domain: lead.email?.split('@')[1] ?? undefined,
          googlePlaceId: lead.business.googlePlaceId ?? undefined,
          instagramHandle: lead.business.instagramHandle ?? undefined,
          reason: 'manual_reject',
        },
      }),
    ]);
  }

  async markDmSent(leadId: string, operatorId: string): Promise<void> {
    const lead = await this.assertLeadInScope(leadId);
    const draft = await this.businessLineContext.db.dmDraft.findFirst({ where: { leadId }, orderBy: { version: 'desc' } });
    if (!draft) throw new NotFoundException(`No DM draft found for lead ${leadId}.`);

    await prisma.$transaction([
      prisma.dmSend.create({
        data: {
          leadId,
          dmDraftId: draft.id,
          sendingAccount: lead.business.instagramHandle ?? 'unknown',
          operatorId,
        },
      }),
      prisma.lead.update({ where: { id: leadId }, data: { status: 'sent' } }),
    ]);
  }

  async setReplyHandled(replyId: string, handledBy: string, status: 'handled' | 'escalated' | 'skipped'): Promise<void> {
    const reply = await prisma.reply.findFirst({ where: { id: replyId }, include: { lead: true } });
    if (!reply || reply.lead?.businessLineId !== this.businessLineContext.getBusinessLineId()) {
      throw new NotFoundException(`Reply ${replyId} not found in this business line.`);
    }
    await prisma.reply.update({
      where: { id: replyId },
      data: { handled: status !== 'skipped', handledBy, handledAt: status !== 'skipped' ? new Date() : null },
    });
  }

  private async assertLeadInScope(leadId: string) {
    const lead = await this.businessLineContext.db.lead.findFirst({ where: { id: leadId }, include: { business: true } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found in this business line.`);
    return lead;
  }
}
