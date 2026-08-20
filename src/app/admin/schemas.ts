import { z } from 'zod';

import { GOVERNORATE_CODES } from '@/lib/egypt';

/**
 * Settings schema.
 *
 * Separate from actions.ts because a `'use server'` module may export
 * only async functions.
 *
 * The attendance bounds are not arbitrary. A radius below 25m locks out
 * honest staff on ordinary GPS drift; above 5km it is not a site
 * boundary. An accuracy limit above 500m accepts a cell-tower estimate
 * that cannot distinguish one district from the next — which would make
 * the geofence decorative.
 */

const timeOfDay = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a 24-hour time such as 08:00');

const trn = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v === '' || v.length === 9, 'A tax registration number is 9 digits');

export const settingsSchema = z.object({
  'org.nameEn': z.string().trim().min(1, 'An organisation name is required').max(200),
  'org.nameAr': z.string().trim().max(200).optional(),
  'org.trn': trn.optional(),
  'org.commercialRegNo': z.string().trim().max(50).optional(),
  'org.addressLine': z.string().trim().max(300).optional(),
  'org.governorateCode': z.coerce
    .number()
    .refine((v) => GOVERNORATE_CODES.has(v), 'Choose one of the 27 governorates')
    .optional(),

  'attendance.workStart': timeOfDay.optional(),
  'attendance.workEnd': timeOfDay.optional(),
  'attendance.lateThresholdMinutes': z.coerce
    .number()
    .int()
    .min(0, 'A grace period cannot be negative')
    .max(240, 'A grace period beyond four hours is not a grace period')
    .optional(),
  'attendance.defaultRadiusMetres': z.coerce
    .number()
    .int()
    .min(25, 'Below 25m, ordinary GPS drift locks out honest staff')
    .max(5000, 'Beyond 5km this stops being a site boundary')
    .optional(),
  'attendance.maxAccuracyMetres': z.coerce
    .number()
    .int()
    .min(10, 'Below 10m almost every real device fix would be refused')
    .max(500, 'Beyond 500m a fix cannot tell one district from the next')
    .optional(),

  'bills.defaultPaymentTermsDays': z.coerce
    .number()
    .int()
    .min(0)
    .max(365, 'Payment terms beyond a year are not terms')
    .optional(),
});
