import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';

@Injectable()
export class SuppressionService {
  constructor(private readonly businessLineContext: BusinessLineContext) {}

  findAll() {
    return this.businessLineContext.db.suppressionEntry.findMany();
  }

  async findOne(id: string) {
    const entry = await this.businessLineContext.db.suppressionEntry.findFirst({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`Suppression entry ${id} not found in this business line.`);
    }
    return entry;
  }

  create(data: Omit<Prisma.SuppressionEntryUncheckedCreateInput, 'businessLineId'>) {
    return this.businessLineContext.db.suppressionEntry.create({
      data: { ...data, businessLineId: this.businessLineContext.getBusinessLineId() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.businessLineContext.db.suppressionEntry.delete({ where: { id } });
  }
}
