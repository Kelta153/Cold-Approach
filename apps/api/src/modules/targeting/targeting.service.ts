import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';

@Injectable()
export class TargetingService {
  constructor(private readonly businessLineContext: BusinessLineContext) {}

  findAll() {
    return this.businessLineContext.db.targetingProfile.findMany();
  }

  async findOne(id: string) {
    const profile = await this.businessLineContext.db.targetingProfile.findFirst({ where: { id } });
    if (!profile) {
      throw new NotFoundException(`Targeting profile ${id} not found in this business line.`);
    }
    return profile;
  }

  create(data: Omit<Prisma.TargetingProfileUncheckedCreateInput, 'businessLineId'>) {
    return this.businessLineContext.db.targetingProfile.create({
      data: { ...data, businessLineId: this.businessLineContext.getBusinessLineId() },
    });
  }

  async update(id: string, data: Prisma.TargetingProfileUpdateInput) {
    await this.findOne(id);
    return this.businessLineContext.db.targetingProfile.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.businessLineContext.db.targetingProfile.delete({ where: { id } });
  }
}
