'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, optionalText, requiredText, id } from '@/lib/action';
import { createProduct, updateProduct, archiveProduct } from '@/lib/services/catalogue';

/**
 * Product mutations.
 *
 * Money fields are carried as strings, not numbers. The service hands
 * them to Prisma's Decimal, and routing them through a JS float first is
 * exactly how a cost of 10.10 becomes 10.099999999999999.
 */

/**
 * A required money/quantity field.
 *
 * Validated as a number so the message is sensible, but passed on as the
 * original string so the Decimal is built from the digits the user typed.
 */
const decimalText = (label: string, opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => opts.min === undefined || Number(v) >= opts.min, `${label} cannot be negative`)
    .refine(
      (v) => opts.max === undefined || Number(v) <= opts.max,
      `${label} is larger than this system allows`,
    );

/** The same, but an empty box means "zero" rather than a validation error. */
const decimalTextOrZero = (label: string, opts: { min?: number; max?: number } = {}) =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? '0' : v), decimalText(label, opts));

const productSchema = z.object({
  sku: requiredText('SKU', 64),
  nameEn: requiredText('Name', 200),
  nameAr: optionalText,
  // An unselected <select> posts "". Normalise to null before the id
  // check, so "no category" is not reported as a malformed id.
  categoryId: z.preprocess((v) => (v === '' || v === undefined ? null : v), id.nullable()),
  vendorId: z.preprocess((v) => (v === '' || v === undefined ? null : v), id.nullable()),
  brand: optionalText,
  unit: requiredText('Unit', 24),
  gpcCode: optionalText,
  costPrice: decimalTextOrZero('Cost price', { min: 0, max: 999_999_999 }),
  salePrice: decimalTextOrZero('Sale price', { min: 0, max: 999_999_999 }),
  // Egypt's standard rate is 14%, but zero-rated and exempt goods exist,
  // so the field is open rather than fixed.
  vatRate: decimalTextOrZero('VAT rate', { min: 0, max: 100 }),
  reorderLevel: decimalTextOrZero('Reorder level', { min: 0, max: 9_999_999 }),
});

const createProductAction = action({
  permission: 'products.create',
  input: productSchema,
  handler: async (input, { actor }) => {
    const product = await createProduct({ actor, input });
    revalidatePath('/products');
    return { id: product.id, sku: product.sku };
  },
});

const updateProductAction = action({
  permission: 'products.edit',
  input: productSchema.partial().extend({ productId: id }),
  handler: async ({ productId, ...input }, { actor }) => {
    const product = await updateProduct({ actor, productId, input });
    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    return { id: product.id };
  },
});

const archiveProductAction = action({
  permission: 'products.delete',
  input: z.object({ productId: id }),
  handler: async ({ productId }, { actor }) => {
    await archiveProduct({ actor, productId });
    revalidatePath('/products');
    return { archived: true as const };
  },
});

/* ============================================================
   FORM ADAPTERS
   ============================================================ */

export async function submitCreateProduct(_previous: unknown, formData: FormData) {
  return createProductAction(formToObject(formData));
}

export async function submitUpdateProduct(_previous: unknown, formData: FormData) {
  return updateProductAction(formToObject(formData));
}

export async function submitArchiveProduct(_previous: unknown, formData: FormData) {
  return archiveProductAction(formToObject(formData));
}
