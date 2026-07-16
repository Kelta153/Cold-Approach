import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { ApprovedVia } from '@outreach-engine/types';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SendingService } from './sending.service';

interface AttemptSendBody {
  draftId: string;
  approvedByUserId: string;
  approvedVia: ApprovedVia;
}

/** The webapp review-queue "Approve" action calls this endpoint with `approvedVia: 'webapp'`.
 * Phase 4 wires the Telegram bot's Approve callback to call `SendingService.attemptSend` the
 * same way with `approvedVia: 'telegram'` — never a separate write path. */
@Controller('sending')
@UseGuards(RolesGuard)
export class SendingController {
  constructor(private readonly sendingService: SendingService) {}

  @Post('attempt')
  @Roles('admin', 'operator')
  attemptSend(@Body() body: AttemptSendBody) {
    if (!body?.draftId || !body?.approvedByUserId || !body?.approvedVia) {
      throw new BadRequestException('draftId, approvedByUserId and approvedVia are required.');
    }
    return this.sendingService.attemptSend(body.draftId, body.approvedByUserId, body.approvedVia);
  }
}
