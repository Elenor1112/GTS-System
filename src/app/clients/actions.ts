'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, optionalText, requiredText, id } from '@/lib/action';
import { createClient, updateClient, archiveClient, restoreClient } from '@/lib/services/clients';
import { GOVERNORATE_CODES } from '@/lib/egypt';

/**
 * Client mutations.
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

const clientSchema = z.object({
  code: requiredText('Client code', 32),
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
  creditLimit: z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? 0 : v),
      z.coerce.number({ message: 'Credit limit must be a number' }),
    )
    .refine((v) => v >= 0, 'A credit limit cannot be negative'),
  notes: optionalText,
});

const createClientAction = action({
  permission: 'clients.create',
  input: clientSchema,
  handler: async (input, { actor }) => {
    const client = await createClient({ actor, input });
    revalidatePath('/clients');
    return { id: client.id, code: client.code };
  },
});

const updateClientAction = action({
  permission: 'clients.edit',
  input: clientSchema.partial().extend({ clientId: id }),
  handler: async ({ clientId, ...input }, { actor }) => {
    const client = await updateClient({ actor, clientId, input });
    revalidatePath('/clients');
    revalidatePath(`/clients/${clientId}`);
    return { id: client.id };
  },
});

const archiveClientAction = action({
  permission: 'clients.delete',
  input: z.object({ clientId: id }),
  handler: async ({ clientId }, { actor }) => {
    await archiveClient({ actor, clientId });
    revalidatePath('/clients');
    return { archived: true as const };
  },
});

const restoreClientAction = action({
  permission: 'clients.delete',
  input: z.object({ clientId: id }),
  handler: async ({ clientId }, { actor }) => {
    await restoreClient({ actor, clientId });
    revalidatePath('/clients');
    revalidatePath(`/clients/${clientId}`);
    return { restored: true as const };
  },
});

/* ============================================================
   FORM ADAPTERS

   `useActionState` hands the action a FormData. These convert it to the
   plain object the schema expects, so the schemas stay reusable by any
   caller — a form, an API route, or a test.
   ============================================================ */

export async function submitCreateClient(_previous: unknown, formData: FormData) {
  return createClientAction(formToObject(formData));
}

export async function submitUpdateClient(_previous: unknown, formData: FormData) {
  return updateClientAction(formToObject(formData));
}

export async function submitArchiveClient(_previous: unknown, formData: FormData) {
  return archiveClientAction(formToObject(formData));
}


/** Callable form of `restoreClientAction`, exported because a 'use server' module
 *  may export only async functions. */
export async function submitRestoreClient(input: unknown) {
  return restoreClientAction(input);
}
