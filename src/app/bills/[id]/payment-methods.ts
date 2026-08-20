/**
 * Payment methods, as an Egyptian business actually uses them.
 *
 * A plain module rather than an import from the Prisma enum: the client
 * component needs these labels, and pulling in the generated client to
 * get five strings would drag the database layer into the bundle.
 * The values match the PaymentMethod enum exactly.
 */
export const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
] as const;
