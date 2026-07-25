import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TemplatesService } from './templates.service';

/** Reading templates is useful context for operators; changing them is admin-only config work —
 * same split as BusinessLinesController. */
@Controller('templates')
@UseGuards(RolesGuard)
export class TemplatesController {
  constructor(@Inject(TemplatesService) private readonly templatesService: TemplatesService) {}

  @Get()
  @Roles('admin', 'operator')
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'operator')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() body: Omit<Prisma.TemplateUncheckedCreateInput, 'businessLineId'>) {
    return this.templatesService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() body: Prisma.TemplateUpdateInput) {
    return this.templatesService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
