import { z } from 'zod';

import { optionalText, requiredText, id } from '@/lib/action';
import { MOBILE_PATTERN } from '@/lib/egypt';

/**
 * User administration schemas.
 *
 * Separate from actions.ts because a `'use server'` module may export
 * only async functions.
 */

/**
 * Twelve characters, no composition rules.
 *
 * Length is what actually resists cracking; forced symbols and mixed
 * case push people towards P@ssw0rd1 and a sticky note.
 */
const password = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200, 'That password is too long');

const phone = z
  .string()
  .trim()
  .regex(MOBILE_PATTERN, 'Enter a valid Egyptian mobile number');

export const newUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  nameEn: requiredText('Name', 200),
  nameAr: requiredText('Name (Arabic)', 200),
  phone,
  roleId: id,
  password,
});

export const updateUserSchema = z.object({
  userId: id,
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
  nameEn: requiredText('Name', 200).optional(),
  nameAr: optionalText.optional(),
  phone: optionalText.optional(),
  roleId: id.optional(),
});

export const activeSchema = z.object({
  userId: id,
  isActive: z.coerce.boolean(),
});

export const resetSchema = z.object({
  userId: id,
  password,
});
