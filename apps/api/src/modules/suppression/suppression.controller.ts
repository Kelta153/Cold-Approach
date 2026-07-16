import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SuppressionService } from './suppression.service';

@Controller('suppression')
@UseGuards(RolesGuard)
@Roles('admin', 'operator')
export class SuppressionController {
  constructor(private readonly suppressionService: SuppressionService) {}

  @Get()
  findAll() {
    return this.suppressionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppressionService.findOne(id);
  }

  @Post()
  create(@Body() body: Omit<Prisma.SuppressionEntryUncheckedCreateInput, 'businessLineId'>) {
    return this.suppressionService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.suppressionService.remove(id);
  }
}
