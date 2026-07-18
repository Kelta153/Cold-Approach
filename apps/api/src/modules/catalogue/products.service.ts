import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';

/**
 * Every query below goes through `BusinessLineContext.db`, never the raw `prisma` export, so
 * `businessLineId` is always the one resolved from the request — callers cannot pass their own.
 */
@Injectable()
export class ProductsService {
  constructor(@Inject(BusinessLineContext) private readonly businessLineContext: BusinessLineContext) {}

  findAll() {
    return this.businessLineContext.db.product.findMany({ include: { variants: true } });
  }

  async findOne(id: string) {
    const product = await this.businessLineContext.db.product.findFirst({
      where: { id },
      include: { variants: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found in this business line.`);
    }
    return product;
  }

  create(data: Omit<Prisma.ProductUncheckedCreateInput, 'businessLineId'>) {
    // businessLineId is resolved from the request context, never accepted from the caller —
    // and would be force-overwritten by the scoped client's Prisma extension even if it were.
    return this.businessLineContext.db.product.create({
      data: { ...data, businessLineId: this.businessLineContext.getBusinessLineId() },
    });
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    await this.findOne(id);
    return this.businessLineContext.db.product.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.businessLineContext.db.product.delete({ where: { id } });
  }
}
