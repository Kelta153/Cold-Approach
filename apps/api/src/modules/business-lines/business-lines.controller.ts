import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessLinesService } from './business-lines.service';

/** Creating/editing a Business Line is admin-only — see §4 of the spec ("Business Line
 * management" is called out as the admin-only example route group). Reading the list is not:
 * every signed-in user (including operators) needs it for the business-line switcher, since
 * every queue is scoped to whichever line is active. */
@Controller('business-lines')
@UseGuards(RolesGuard)
export class BusinessLinesController {
  constructor(@Inject(BusinessLinesService) private readonly businessLinesService: BusinessLinesService) {}

  @Get()
  @Roles('admin', 'operator')
  findAll() {
    return this.businessLinesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'operator')
  findOne(@Param('id') id: string) {
    return this.businessLinesService.findOne(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() body: Prisma.BusinessLineCreateInput) {
    return this.businessLinesService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() body: Prisma.BusinessLineUpdateInput) {
    return this.businessLinesService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.businessLinesService.remove(id);
  }
}
