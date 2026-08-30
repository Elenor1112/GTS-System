'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, optionalText, requiredText, id } from '@/lib/action';
import { createVendor, updateVendor, archiveVendor } from '@/lib/services/vendors';
import { GOVERNORATE_CODES } from '@/lib/egypt';

/**
 * Vendor mutations.
 *
 * Each one names the permission it needs; `action()` enforces it against
 * the database before the handler runs, so a request that reaches these
 * functions has already been authorised.
 */

/** Egyptian tax registration numbers are 9 digits, shown 123-456-789. */
const trnSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v === '' || v.length === 9, 'A tax registration number is 9 digits')
  .transform((v) => (v === '' ? null : v))
  .nullable();

const vendorSchema = z.object({
  nameEn: requiredText('Name', 200),
  nameAr: optionalText,
  trn: trnSchema.optional(),
  commercialRegNo: optionalText,
  // An unselected <select> posts an empty string, and "not chosen" is a
  // legitimate answer here. Normalise to null FIRST, then validate only
  // the values that are actually present — refining before the transform
  // rejects the empty case as if it were a bad governorate.
  governorateCode: z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
      z.number().nullable(),
    )
    .refine(
      (v) => v === null || GOVERNORATE_CODES.has(v),
      'Choose one of the 27 governorates',
    ),
  // The <select> posts one of the known fields, or the sentinel "Other"
  // paired with free text in `fieldOther`. Resolve to a single value here
  // so the rest of the app only ever sees `field` — never the sentinel.
  field: z.string().trim().optional(),
  fieldOther: z.string().trim().max(100).optional(),
  addressLine: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
  contactEmail: z
    .union([z.string().trim().email('Enter a valid email address'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  // `.default()` only fires on `undefined`, and an emptied number field
  // posts "" — which coerces to 0. Left alone, clearing this box would
  // silently mean "due immediately" rather than "use the default".
  paymentTermsDays: z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? 30 : v),
      z.coerce.number({ message: 'Payment terms must be a number' }),
    )
    .refine((v) => v >= 0 && v <= 365, 'Payment terms must be between 0 and 365 days'),
  notes: optionalText,
});

/**
 * Resolve the field select and its "Other" sidecar into one value.
 *
 * The client only ever emits `field: "Other"` alongside `fieldOther` when
 * the sentinel is chosen; anywhere else `fieldOther` is absent. Doing this
 * outside the schema keeps `vendorSchema.partial()` simple for updates.
 */
function resolveField<T extends { field?: string; fieldOther?: string }>({
  field, fieldOther, ...rest
}: T) {
  const resolved = field === 'Other' ? fieldOther?.trim() || undefined : field;
  return { ...rest, field: resolved === undefined ? resolved : resolved || null };
}

const createVendorAction = action({
  permission: 'vendors.create',
  input: vendorSchema.transform(resolveField),
  handler: async (input, { actor }) => {
    const vendor = await createVendor({ actor, input });
    revalidatePath('/vendors');
    return { id: vendor.id, code: vendor.code };
  },
});

const updateVendorAction = action({
  permission: 'vendors.edit',
  input: vendorSchema
    .partial()
    .extend({ vendorId: id, code: requiredText('Vendor code', 32) })
    .transform(resolveField),
  handler: async ({ vendorId, ...input }, { actor }) => {
    const vendor = await updateVendor({ actor, vendorId, input });
    revalidatePath('/vendors');
    revalidatePath(`/vendors/${vendorId}`);
    return { id: vendor.id };
  },
});

const archiveVendorAction = action({
  permission: 'vendors.delete',
  input: z.object({ vendorId: id }),
  handler: async ({ vendorId }, { actor }) => {
    await archiveVendor({ actor, vendorId });
    revalidatePath('/vendors');
    return { archived: true as const };
  },
});


/* ============================================================
   FORM ADAPTERS

   `useActionState` hands the action a FormData. These convert it to the
   plain object the schema expects, so the schemas stay reusable by any
   caller — a form, an API route, or a test.
   ============================================================ */

export async function submitCreateVendor(_previous: unknown, formData: FormData) {
  return createVendorAction(formToObject(formData));
}

export async function submitUpdateVendor(_previous: unknown, formData: FormData) {
  return updateVendorAction(formToObject(formData));
}

export async function submitArchiveVendor(_previous: unknown, formData: FormData) {
  return archiveVendorAction(formToObject(formData));
}
