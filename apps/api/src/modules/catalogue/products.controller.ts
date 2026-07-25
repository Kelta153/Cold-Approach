import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProductVariantsService } from './product-variants.service';
import { ProductsService } from './products.service';

/** Reading the catalogue is useful context for operators working the queues; changing it is
 * admin-only config work — same split as BusinessLinesController. */
@Controller('catalogue/products')
@UseGuards(RolesGuard)
export class ProductsController {
  constructor(
    @Inject(ProductsService) private readonly productsService: ProductsService,
    @Inject(ProductVariantsService) private readonly variantsService: ProductVariantsService,
  ) {}

  @Get()
  @Roles('admin', 'operator')
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'operator')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() body: Omit<Prisma.ProductUncheckedCreateInput, 'businessLineId'>) {
    return this.productsService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() body: Prisma.ProductUpdateInput) {
    return this.productsService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get(':id/variants')
  @Roles('admin', 'operator')
  findVariants(@Param('id') id: string) {
    return this.variantsService.findAllForProduct(id);
  }

  @Post(':id/variants')
  @Roles('admin')
  createVariant(@Param('id') id: string, @Body() body: Omit<Prisma.ProductVariantUncheckedCreateInput, 'productId'>) {
    return this.variantsService.create(id, body);
  }

  @Patch(':id/variants/:variantId')
  @Roles('admin')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() body: Prisma.ProductVariantUpdateInput,
  ) {
    return this.variantsService.update(id, variantId, body);
  }

  @Delete(':id/variants/:variantId')
  @Roles('admin')
  removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.variantsService.remove(id, variantId);
  }
}
