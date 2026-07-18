import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@outreach-engine/db';
import type { ApprovedVia, SendCheckContext, SendCheckResult } from '@outreach-engine/types';
import { pickSendingInbox } from '../../common/pick-sending-inbox';
import { ComplianceService } from '../compliance/compliance.service';
import { sendViaInstantly } from './instantly-adapter';

/**
 * `sending` is the *only* module in `apps/api` allowed to write a `Send` row — see the
 * `prisma.send.create` call below. `attemptSend` is the single enforced path: it always calls
 * the compliance chokepoint first and refuses to write anything if `allowed` is false. The
 * webapp review-queue "Approve" action and the (Phase 4) Telegram "Approve" callback both call
 * this exact method with a different `approvedVia` — there is no second path.
 */
@Injectable()
export class SendingService {
  constructor(@Inject(ComplianceService) private readonly compliance: ComplianceService) {}

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

    // Real provider dispatch — isolated in its own adapter, which itself decides whether to
    // actually call Instantly or (with no INSTANTLY_API_KEY) return a simulated result. Either
    // way, the compliance chokepoint above already gated this send; this step only decides how
    // an already-approved send goes out.
    const dispatch = await sendViaInstantly({
      to: draft.lead.email ?? '',
      subject: draft.subject,
      body: draft.body,
      fromInbox: ctx.sendingInbox,
    });

    await prisma.send.create({
      data: {
        leadId: draft.leadId,
        draftId: draft.id,
        sendingInbox: ctx.sendingInbox,
        status: 'sent',
        approvedByUserId,
        approvedVia,
        providerMessageId: dispatch.providerMessageId,
        simulated: dispatch.simulated,
      },
    });

    await prisma.lead.update({ where: { id: draft.leadId }, data: { status: 'sent' } });

    return result;
  }
}
