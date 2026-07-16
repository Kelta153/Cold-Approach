import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, type Prisma } from '@outreach-engine/db';

/**
 * `BusinessLine` is the tenant itself, not a business-scoped model — it does not carry a
 * `businessLineId` column and is intentionally not queried through `BusinessLineContext`'s
 * scoped client. Management of Business Lines is restricted to `admin` at the controller level
 * (see `business-lines.controller.ts`) instead.
 */
@Injectable()
export class BusinessLinesService {
  findAll() {
    return prisma.businessLine.findMany();
  }

  async findOne(id: string) {
    const businessLine = await prisma.businessLine.findUnique({ where: { id } });
    if (!businessLine) {
      throw new NotFoundException(`Business line ${id} not found.`);
    }
    return businessLine;
  }

  create(data: Prisma.BusinessLineCreateInput) {
    return prisma.businessLine.create({ data });
  }

  async update(id: string, data: Prisma.BusinessLineUpdateInput) {
    await this.findOne(id);
    return prisma.businessLine.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return prisma.businessLine.delete({ where: { id } });
  }
}
