import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessLinesService } from './business-lines.service';

/** Business Line management (creating/editing a brand/venture) is admin-only — see §4 of the
 * spec ("Business Line management" is called out as the admin-only example route group). */
@Controller('business-lines')
@UseGuards(RolesGuard)
@Roles('admin')
export class BusinessLinesController {
  constructor(private readonly businessLinesService: BusinessLinesService) {}

  @Get()
  findAll() {
    return this.businessLinesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessLinesService.findOne(id);
  }

  @Post()
  create(@Body() body: Prisma.BusinessLineCreateInput) {
    return this.businessLinesService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Prisma.BusinessLineUpdateInput) {
    return this.businessLinesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.businessLinesService.remove(id);
  }
}
