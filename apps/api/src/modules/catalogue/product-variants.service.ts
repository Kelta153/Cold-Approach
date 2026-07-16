import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, type Prisma } from '@outreach-engine/db';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';

/**
 * `ProductVariant` has no `businessLineId` column of its own (see schema) — it is scoped
 * transitively through its parent `Product`. Every method here first resolves the parent
 * product through the business-line-scoped client, so a variant belonging to another business
 * line's product can never be read or written even though the variants table itself isn't in
 * `BUSINESS_LINE_SCOPED_MODELS`.
 */
@Injectable()
export class ProductVariantsService {
  constructor(private readonly businessLineContext: BusinessLineContext) {}

  private async assertProductInScope(productId: string) {
    const product = await this.businessLineContext.db.product.findFirst({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found in this business line.`);
    }
    return product;
  }

  async findAllForProduct(productId: string) {
    await this.assertProductInScope(productId);
    return prisma.productVariant.findMany({ where: { productId } });
  }

  async create(productId: string, data: Omit<Prisma.ProductVariantUncheckedCreateInput, 'productId'>) {
    await this.assertProductInScope(productId);
    return prisma.productVariant.create({ data: { ...data, productId } });
  }

  async update(productId: string, variantId: string, data: Prisma.ProductVariantUpdateInput) {
    await this.assertProductInScope(productId);
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found on product ${productId}.`);
    }
    return prisma.productVariant.update({ where: { id: variantId }, data });
  }

  async remove(productId: string, variantId: string) {
    await this.assertProductInScope(productId);
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found on product ${productId}.`);
    }
    return prisma.productVariant.delete({ where: { id: variantId } });
  }
}
