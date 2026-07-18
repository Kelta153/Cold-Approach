import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TargetingService } from './targeting.service';

@Controller('targeting-profiles')
@UseGuards(RolesGuard)
@Roles('admin', 'operator')
export class TargetingController {
  constructor(@Inject(TargetingService) private readonly targetingService: TargetingService) {}

  @Get()
  findAll() {
    return this.targetingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.targetingService.findOne(id);
  }

  @Post()
  create(@Body() body: Omit<Prisma.TargetingProfileUncheckedCreateInput, 'businessLineId'>) {
    return this.targetingService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Prisma.TargetingProfileUpdateInput) {
    return this.targetingService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.targetingService.remove(id);
  }
}
