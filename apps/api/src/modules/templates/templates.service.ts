import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';

@Injectable()
export class TemplatesService {
  constructor(@Inject(BusinessLineContext) private readonly businessLineContext: BusinessLineContext) {}

  findAll() {
    return this.businessLineContext.db.template.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const template = await this.businessLineContext.db.template.findFirst({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template ${id} not found in this business line.`);
    }
    return template;
  }

  create(data: Omit<Prisma.TemplateUncheckedCreateInput, 'businessLineId'>) {
    return this.businessLineContext.db.template.create({
      data: { ...data, businessLineId: this.businessLineContext.getBusinessLineId() },
    });
  }

  async update(id: string, data: Prisma.TemplateUpdateInput) {
    await this.findOne(id);
    return this.businessLineContext.db.template.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.businessLineContext.db.template.delete({ where: { id } });
  }
}
