import { apiFetch } from '../api-client';

export interface ProductVariantRaw {
  id: string;
  productId: string;
  variantName: string;
  price: string; // Decimal serializes as a string over JSON
  moq: number;
  attributes: unknown;
}

export interface ProductRaw {
  id: string;
  name: string;
  description: string;
  keyFeatures: string[];
  targetBusinessTypes: string[];
  link: string;
  active: boolean;
  variants: ProductVariantRaw[];
}

/** One row per variant (price/MOQ are variant-level, not product-level — see schema.prisma). A
 * product with no variants yet still gets a row so it's visible right after creation. */
export interface CatalogueRow {
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  priceLabel: string;
  moq: number | null;
  active: boolean;
}

export function toCatalogueRows(products: ProductRaw[]): CatalogueRow[] {
  return products.flatMap((p): CatalogueRow[] =>
    p.variants.length > 0
      ? p.variants.map(
          (v): CatalogueRow => ({
            productId: p.id,
            variantId: v.id,
            sku: v.id.slice(0, 8),
            name: `${p.name} — ${v.variantName}`,
            priceLabel: `£${v.price} / unit`,
            moq: v.moq,
            active: p.active,
          }),
        )
      : [{ productId: p.id, variantId: null, sku: p.id.slice(0, 8), name: p.name, priceLabel: '—', moq: null, active: p.active }],
  );
}

export async function getProducts(lineId: string): Promise<ProductRaw[]> {
  return apiFetch<ProductRaw[]>('/catalogue/products', { businessLineId: lineId });
}

export interface CreateProductInput {
  name: string;
  description: string;
  keyFeatures: string[];
  targetBusinessTypes: string[];
  link: string;
  variantName: string;
  price: number;
  moq: number;
}

/** Creates a Product and its first Variant in one form submission — two real API calls, since
 * variants are a separate resource (POST /catalogue/products/:id/variants). */
export async function createProduct(lineId: string, input: CreateProductInput): Promise<ProductRaw> {
  const product = await apiFetch<ProductRaw>('/catalogue/products', {
    method: 'POST',
    businessLineId: lineId,
    body: {
      name: input.name,
      description: input.description,
      keyFeatures: input.keyFeatures,
      targetBusinessTypes: input.targetBusinessTypes,
      link: input.link,
      active: true,
    },
  });

  const variant = await apiFetch<ProductVariantRaw>(`/catalogue/products/${product.id}/variants`, {
    method: 'POST',
    businessLineId: lineId,
    body: { variantName: input.variantName, price: input.price, moq: input.moq, attributes: {} },
  });

  return { ...product, variants: [variant] };
}

export async function setProductActive(lineId: string, productId: string, active: boolean): Promise<void> {
  await apiFetch(`/catalogue/products/${productId}`, { method: 'PATCH', businessLineId: lineId, body: { active } });
}

/** Variants carry a plain (non-cascading) foreign key to their product — deleting the product
 * first would 500 on the FK constraint if any variant still exists, so remove those first. */
export async function deleteProduct(lineId: string, productId: string, variantIds: string[]): Promise<void> {
  for (const variantId of variantIds) {
    await apiFetch(`/catalogue/products/${productId}/variants/${variantId}`, { method: 'DELETE', businessLineId: lineId });
  }
  await apiFetch(`/catalogue/products/${productId}`, { method: 'DELETE', businessLineId: lineId });
}
