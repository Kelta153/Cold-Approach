import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@outreach-engine/db';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProductVariantsService } from './product-variants.service';
import { ProductsService } from './products.service';

@Controller('catalogue/products')
@UseGuards(RolesGuard)
@Roles('admin', 'operator')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly variantsService: ProductVariantsService,
  ) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() body: Omit<Prisma.ProductUncheckedCreateInput, 'businessLineId'>) {
    return this.productsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Prisma.ProductUpdateInput) {
    return this.productsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get(':id/variants')
  findVariants(@Param('id') id: string) {
    return this.variantsService.findAllForProduct(id);
  }

  @Post(':id/variants')
  createVariant(@Param('id') id: string, @Body() body: Omit<Prisma.ProductVariantUncheckedCreateInput, 'productId'>) {
    return this.variantsService.create(id, body);
  }

  @Patch(':id/variants/:variantId')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() body: Prisma.ProductVariantUpdateInput,
  ) {
    return this.variantsService.update(id, variantId, body);
  }

  @Delete(':id/variants/:variantId')
  removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.variantsService.remove(id, variantId);
  }
}
