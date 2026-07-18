import { BadRequestException, Body, Controller, Inject, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { ApprovedVia } from '@outreach-engine/types';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SendingService } from './sending.service';

interface AttemptSendBody {
  draftId: string;
  approvedVia: ApprovedVia;
}

type RequestWithAuthUser = Request & { authUser?: { id: string } };

/** The webapp review-queue "Approve" action calls this endpoint with `approvedVia: 'webapp'`.
 * Phase 4 wires the Telegram bot's Approve callback to call `SendingService.attemptSend` the
 * same way with `approvedVia: 'telegram'` — never a separate write path.
 *
 * `approvedByUserId` is deliberately NOT accepted from the request body — a client could claim
 * any user id. `RolesGuard` already resolves and attaches the real session user to
 * `request.authUser`; that's the only source of truth for who approved a send. */
@Controller('sending')
@UseGuards(RolesGuard)
export class SendingController {
  constructor(@Inject(SendingService) private readonly sendingService: SendingService) {}

  @Post('attempt')
  @Roles('admin', 'operator')
  attemptSend(@Req() req: RequestWithAuthUser, @Body() body: AttemptSendBody) {
    const approvedByUserId = req.authUser?.id;
    if (!approvedByUserId) {
      throw new UnauthorizedException('No authenticated user on this session.');
    }
    if (!body?.draftId || !body?.approvedVia) {
      throw new BadRequestException('draftId and approvedVia are required.');
    }
    return this.sendingService.attemptSend(body.draftId, approvedByUserId, body.approvedVia);
  }
}
