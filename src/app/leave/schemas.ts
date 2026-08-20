import { z } from 'zod';

import { dateOnly, optionalText, id } from '@/lib/action';

/**
 * Leave input schemas.
 *
 * Separate from actions.ts because a `'use server'` module may export
 * only async functions.
 */

export const requestSchema = z
  .object({
    /** Omitted means "my own". Only `leave.manage` may name somebody else. */
    employeeId: z.string().optional().nullable(),
    leaveTypeId: id,
    startsOn: dateOnly,
    endsOn: dateOnly,
    reason: optionalText.optional(),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    message: 'The last day cannot fall before the first',
    path: ['endsOn'],
  });

export const decisionSchema = z.object({
  requestId: id,
  note: optionalText.optional(),
});

export const cancelSchema = z.object({
  requestId: id,
  note: optionalText.optional(),
});
