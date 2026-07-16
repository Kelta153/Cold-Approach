import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@outreach-engine/db';
import type { ApprovedVia, SendCheckContext, SendCheckResult } from '@outreach-engine/types';
import { ComplianceService } from '../compliance/compliance.service';

interface SendingInboxConfig {
  email: string;
  dailyCap: number;
  active: boolean;
}

function pickSendingInbox(sendingInboxes: unknown): string {
  const inboxes = Array.isArray(sendingInboxes) ? (sendingInboxes as SendingInboxConfig[]) : [];
  const active = inboxes.find((inbox) => inbox?.active);
  return active?.email ?? inboxes[0]?.email ?? '';
}

/**
 * `sending` is the *only* module in `apps/api` allowed to write a `Send` row — see the
 * `prisma.send.create` call below. `attemptSend` is the single enforced path: it always calls
 * the compliance chokepoint first and refuses to write anything if `allowed` is false. The
 * webapp review-queue "Approve" action and the (Phase 4) Telegram "Approve" callback both call
 * this exact method with a different `approvedVia` — there is no second path.
 */
@Injectable()
export class SendingService {
  constructor(private readonly compliance: ComplianceService) {}

  async attemptSend(draftId: string, approvedByUserId: string, approvedVia: ApprovedVia): Promise<SendCheckResult> {
    const draft = await prisma.draft.findUnique({
      where: { id: draftId },
      include: { lead: { include: { businessLine: true } } },
    });

    if (!draft) {
      throw new NotFoundException(`Draft ${draftId} not found.`);
    }

    const ctx: SendCheckContext = {
      leadId: draft.leadId,
      businessLineId: draft.lead.businessLineId,
      sendingInbox: pickSendingInbox(draft.lead.businessLine.sendingInboxes),
    };

    const result = await this.compliance.runChokepoint(ctx);

    if (!result.allowed) {
      return result;
    }

    // Actual provider dispatch (Instantly) is Phase 4 — recording the Send row here is what
    // makes this the audited "point of send" today: it captures who approved it and how.
    await prisma.send.create({
      data: {
        leadId: draft.leadId,
        draftId: draft.id,
        sendingInbox: ctx.sendingInbox,
        status: 'sent',
        approvedByUserId,
        approvedVia,
      },
    });

    return result;
  }
}
