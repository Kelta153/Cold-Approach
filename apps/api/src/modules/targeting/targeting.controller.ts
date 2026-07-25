import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TargetingService } from './targeting.service';

/** Reading targeting profiles is useful context for operators; changing them is admin-only
 * config work — same split as BusinessLinesController. */
@Controller('targeting-profiles')
@UseGuards(RolesGuard)
export class TargetingController {
  constructor(@Inject(TargetingService) private readonly targetingService: TargetingService) {}

  @Get()
  @Roles('admin', 'operator')
  findAll() {
    return this.targetingService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'operator')
  findOne(@Param('id') id: string) {
    return this.targetingService.findOne(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() body: Omit<Prisma.TargetingProfileUncheckedCreateInput, 'businessLineId'>) {
    return this.targetingService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() body: Prisma.TargetingProfileUpdateInput) {
    return this.targetingService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.targetingService.remove(id);
  }
}
