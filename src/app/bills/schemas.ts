import { z } from 'zod';

import { dateOnly, optionalText, requiredText, id } from '@/lib/action';

/**
 * Bill input schemas.
 *
 * In their own module because a `'use server'` file may export ONLY
 * async functions — Next turns every export into a callable endpoint, so
 * a exported const schema fails the build with "Server Actions must be
 * async functions". Keeping the schemas here also makes them reusable by
 * a test or an API route without importing the actions.
 *
 * NOTE WHAT IS ABSENT: subtotal, VAT, total. A bill's totals are computed
 * by the server from its line items, so there is no field in which a
 * browser could assert one. Zod strips any extra keys before the handler
 * sees them.
 */

/** An empty numeric input posts "", which coerces to 0 — rarely the
 *  intent. This normalises "not filled in" to the stated default. */
const numberWithDefault = (fallback: number, schema: z.ZodType<number>) =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? fallback : v), schema);

export const lineSchema = z.object({
  /*
   * "" means "free text line", not "the product whose id is empty".
   *
   * The <select> offers a "Free text line" option whose value is the
   * empty string, and `z.string()` accepts that as a perfectly good
   * string — so it travelled all the way to Prisma and violated
   * `bill_items_productId_fkey`. Normalising to null here is what makes
   * a free-text line insertable.
   */
  productId: z.preprocess((v) => (v === '' ? null : v), z.string().optional().nullable()),
  descriptionEn: requiredText('Description', 300),
  descriptionAr: optionalText.optional(),
  itemCode: optionalText.optional(),
  gpcCode: optionalText.optional(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit: z.string().trim().min(1).max(8).default('EA'),
  unitPrice: z.coerce.number().nonnegative('A unit price cannot be negative'),
  discount: numberWithDefault(0, z.coerce.number().nonnegative('A discount cannot be negative')),
  vatRate: numberWithDefault(14, z.coerce.number().min(0).max(100, 'VAT must be between 0 and 100')),
});

export const createBillSchema = z
  .object({
    direction: z.enum(['RECEIVABLE', 'PAYABLE']),
    clientId: z.string().optional().nullable(),
    vendorId: z.string().optional().nullable(),
    projectId: z.string().optional().nullable(),
    issuedOn: dateOnly,
    dueOn: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.union([dateOnly, z.null()]),
    ),
    currency: z.string().trim().length(3).default('EGP'),
    exchangeRate: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.union([z.coerce.number().positive(), z.null()]),
    ),
    whtRate: numberWithDefault(0, z.coerce.number().min(0).max(100)),
    notes: optionalText.optional(),
    lines: z.array(lineSchema).min(1, 'A bill needs at least one line'),
  })
  .refine((v) => (v.direction === 'RECEIVABLE' ? Boolean(v.clientId) : true), {
    message: 'Choose the client this is issued to',
    path: ['clientId'],
  })
  .refine((v) => (v.direction === 'PAYABLE' ? Boolean(v.vendorId) : true), {
    message: 'Choose the vendor this came from',
    path: ['vendorId'],
  });

export const updateLinesSchema = z.object({
  billId: id,
  whtRate: numberWithDefault(0, z.coerce.number().min(0).max(100)),
  lines: z.array(lineSchema).min(1, 'A bill needs at least one line'),
});

export const withNoteSchema = z.object({ billId: id, note: optionalText.optional() });

export const withReasonSchema = z.object({ billId: id, note: requiredText('A reason', 500) });

export const paymentSchema = z.object({
  billId: id,
  amount: z.coerce.number().positive('A payment must be greater than zero'),
  whtDeducted: numberWithDefault(
    0,
    z.coerce.number().nonnegative('Withholding cannot be negative'),
  ),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER']).default('BANK_TRANSFER'),
  reference: optionalText.optional(),
  notes: optionalText.optional(),
  receivedOn: dateOnly,
});
