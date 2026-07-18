import { Controller, Get, Inject, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueueService } from './queue.service';

type RequestWithAuthUser = Request & { authUser?: { id: string } };

function requireUserId(req: RequestWithAuthUser): string {
  const id = req.authUser?.id;
  if (!id) throw new UnauthorizedException('No authenticated user on this session.');
  return id;
}

@Controller('queue')
@UseGuards(RolesGuard)
@Roles('admin', 'operator')
export class QueueController {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  @Get('review')
  getReviewQueue() {
    return this.queueService.getReviewQueue();
  }

  @Get('replies')
  getReplyQueue() {
    return this.queueService.getReplyQueue();
  }

  @Get('dm')
  getDmQueue() {
    return this.queueService.getDmQueue();
  }

  @Post('review/:leadId/skip')
  skipReview(@Param('leadId') leadId: string) {
    return this.queueService.skipLead(leadId);
  }

  @Post('review/:leadId/reject')
  rejectReview(@Param('leadId') leadId: string) {
    return this.queueService.rejectLead(leadId);
  }

  @Post('dm/:leadId/skip')
  skipDm(@Param('leadId') leadId: string) {
    return this.queueService.skipLead(leadId);
  }

  @Post('dm/:leadId/reject')
  rejectDm(@Param('leadId') leadId: string) {
    return this.queueService.rejectLead(leadId);
  }

  @Post('dm/:leadId/sent')
  markDmSent(@Req() req: RequestWithAuthUser, @Param('leadId') leadId: string) {
    return this.queueService.markDmSent(leadId, requireUserId(req));
  }

  @Post('replies/:replyId/handled')
  markReplyHandled(@Req() req: RequestWithAuthUser, @Param('replyId') replyId: string) {
    return this.queueService.setReplyHandled(replyId, requireUserId(req), 'handled');
  }

  @Post('replies/:replyId/escalate')
  escalateReply(@Req() req: RequestWithAuthUser, @Param('replyId') replyId: string) {
    return this.queueService.setReplyHandled(replyId, requireUserId(req), 'escalated');
  }

  @Post('replies/:replyId/skip')
  skipReply(@Req() req: RequestWithAuthUser, @Param('replyId') replyId: string) {
    return this.queueService.setReplyHandled(replyId, requireUserId(req), 'skipped');
  }
}
