import { Body, Controller, Get, Inject, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { CreateBatchDto } from '@outreach-engine/types';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BatchesService } from './batches.service';
import { DiscoveryService } from './discovery.service';

type RequestWithAuthUser = Request & { authUser?: { id: string } };

/** Running a batch spends real Google Places + Anthropic API quota, so triggering one is
 * admin-only — reading batch history is not (operators watch progress too). */
@Controller('batches')
@UseGuards(RolesGuard)
export class BatchesController {
  constructor(
    @Inject(BatchesService) private readonly batchesService: BatchesService,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
  ) {}

  @Get()
  @Roles('admin', 'operator')
  findAll() {
    return this.batchesService.findAll();
  }

  // Registered before `:id` below — a static segment must come first, or `/batches/redis-cooldown`
  // would otherwise match `findOne` with `id: 'redis-cooldown'`.
  @Get('redis-cooldown')
  @Roles('admin', 'operator')
  getRedisCooldown() {
    return this.discoveryService.getRedisCooldownStatus();
  }

  @Get(':id')
  @Roles('admin', 'operator')
  findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }

  @Post()
  @Roles('admin')
  run(@Req() req: RequestWithAuthUser, @Body() body: CreateBatchDto) {
    const userId = req.authUser?.id;
    if (!userId) throw new UnauthorizedException('No authenticated user on this session.');
    return this.discoveryService.runBatch(body, userId);
  }

  /** Ends an active Redis-outage cooldown early — see `DiscoveryService.clearRedisCooldown`.
   * Admin-only, same reasoning as triggering a batch: this is an explicit operational decision,
   * not something operators should be able to do. */
  @Post('redis-cooldown/clear')
  @Roles('admin')
  clearRedisCooldown() {
    return this.discoveryService.clearRedisCooldown();
  }
}
