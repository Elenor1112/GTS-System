'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, optionalText, requiredText, id } from '@/lib/action';
import { createProduct, updateProduct, archiveProduct, resolveOrCreateCategory } from '@/lib/services/catalogue';

/** Posted as `categoryId` when the user picks "Other" and types a new category name. */
const OTHER_CATEGORY = '__other__';

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

/**
 * The "Other" sentinel requires a name to create the category from.
 *
 * Applied after `.extend()`/`.partial()` rather than baked into
 * `productSchema` itself, since a `ZodEffects` from `.refine()` cannot be
 * extended or made partial.
 */
const requireNewCategoryName = <T extends z.ZodType<{ categoryId?: string | null; newCategoryName?: string | null }>>(
  schema: T,
) =>
  schema.refine((v) => v.categoryId !== OTHER_CATEGORY || Boolean(v.newCategoryName?.trim()), {
    message: 'New category name is required',
    path: ['newCategoryName'],
  });

const productSchema = z.object({
  nameEn: requiredText('Name', 200),
  nameAr: optionalText,
  // An unselected <select> posts "". Normalise to null before the id
  // check, so "no category" is not reported as a malformed id. The
  // "Other" sentinel is left as-is here and resolved to a real id
  // (creating the category if needed) in the form adapters below.
  categoryId: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([id, z.literal(OTHER_CATEGORY)]).nullable(),
  ),
  newCategoryName: optionalText,
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

/**
 * Create-only: where the product physically starts out.
 *
 * Not part of `productSchema` because an edit form must never silently
 * re-receive stock — `warehouseId` has no meaning once a product exists
 * in more than one warehouse.
 */
const createProductSchema = requireNewCategoryName(
  productSchema.extend({
    warehouseId: id,
    openingQuantity: decimalTextOrZero('Opening quantity', { min: 0, max: 9_999_999 }),
    binLocation: optionalText,
  }),
);

const createProductAction = action({
  permission: 'products.create',
  input: createProductSchema,
  handler: async ({ categoryId, newCategoryName, ...input }, { actor }) => {
    const resolvedCategoryId =
      categoryId === OTHER_CATEGORY ? await resolveOrCreateCategory(newCategoryName!.trim()) : categoryId;
    const product = await createProduct({ actor, input: { ...input, categoryId: resolvedCategoryId } });
    revalidatePath('/products');
    return { id: product.id, sku: product.sku };
  },
});

const updateProductAction = action({
  permission: 'products.edit',
  input: requireNewCategoryName(productSchema.partial()).and(
    z.object({ productId: id, sku: requiredText('SKU', 64) }),
  ),
  handler: async ({ productId, categoryId, newCategoryName, ...input }, { actor }) => {
    const resolvedCategoryId =
      categoryId === OTHER_CATEGORY ? await resolveOrCreateCategory(newCategoryName!.trim()) : categoryId;
    const product = await updateProduct({
      actor,
      productId,
      input: { ...input, ...(categoryId !== undefined ? { categoryId: resolvedCategoryId } : {}) },
    });
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
