'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, optionalText, requiredText, id } from '@/lib/action';
import { createWarehouse, updateWarehouse } from '@/lib/services/catalogue';
import { GOVERNORATE_CODES } from '@/lib/egypt';

/**
 * Warehouse mutations.
 *
 * `warehouses.manage` covers both creating and editing — the permission
 * table does not split them the way vendors' create/edit/delete are
 * split, so neither does this file.
 *
 * There is deliberately no archive action. A warehouse holds stock, and
 * the ledger references it forever; removing one is not a screen-level
 * decision, and `isActive` is what takes a building out of use.
 */

/**
 * An optional decimal that tolerates an emptied box.
 *
 * A cleared number input posts "", which `z.coerce.number()` turns into
 * 0 — so clearing a coordinate would silently mean "the origin off the
 * coast of Ghana" and clearing capacity would mean "holds nothing"
 * rather than "not recorded". Empty is normalised to null FIRST, and
 * only present values are range-checked.
 */
const optionalNumber = (label: string, min: number, max: number) =>
  z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
      z.number({ message: `${label} must be a number` }).nullable(),
    )
    .refine((v) => v === null || (v >= min && v <= max), `${label} must be between ${min} and ${max}`);

const warehouseSchema = z.object({
  nameEn: requiredText('Name', 200),
  nameAr: optionalText,
  // Same shape as the vendor schema: normalise "not chosen" to null
  // before validating, so an unselected <select> is not reported as an
  // invalid governorate.
  governorateCode: z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
      z.number().nullable(),
    )
    .refine((v) => v === null || GOVERNORATE_CODES.has(v), 'Choose one of the 27 governorates'),
  addressLine: optionalText,
  // Egypt spans roughly 22–32°N, 25–37°E, but the bounds here are the
  // full legal range: a warehouse is where the business says it is, and
  // a coordinate typo is better caught by the map link than by a
  // validator that refuses a legitimate site near a border.
  latitude: optionalNumber('Latitude', -90, 90),
  longitude: optionalNumber('Longitude', -180, 180),
  capacityM3: optionalNumber('Capacity', 0, 9_999_999),
});

const createWarehouseAction = action({
  permission: 'warehouses.manage',
  input: warehouseSchema,
  handler: async (input, { actor }) => {
    const warehouse = await createWarehouse({ actor, input });
    revalidatePath('/storage');
    return { id: warehouse.id, code: warehouse.code };
  },
});

const updateWarehouseAction = action({
  permission: 'warehouses.manage',
  input: warehouseSchema.partial().extend({ warehouseId: id, code: requiredText('Warehouse code', 32) }),
  handler: async ({ warehouseId, ...input }, { actor }) => {
    const warehouse = await updateWarehouse({ actor, warehouseId, input });
    revalidatePath('/storage');
    revalidatePath(`/storage/${warehouseId}`);
    return { id: warehouse.id };
  },
});

/* ============================================================
   FORM ADAPTERS
   ============================================================ */

export async function submitCreateWarehouse(_previous: unknown, formData: FormData) {
  return createWarehouseAction(formToObject(formData));
}

export async function submitUpdateWarehouse(_previous: unknown, formData: FormData) {
  return updateWarehouseAction(formToObject(formData));
}
