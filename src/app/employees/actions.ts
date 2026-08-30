'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, dateOnly, optionalText, requiredText, id } from '@/lib/action';
import { createEmployee, updateEmployee, archiveEmployee } from '@/lib/services/people';

/**
 * Employee mutations.
 *
 * `employees.manage` covers both creating and editing, matching the
 * warehouse permission shape — the role table does not split them.
 */

const employeeSchema = z.object({
  nameEn: requiredText('Name', 200),
  nameAr: optionalText,
  nationalId: z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : String(v).replace(/\D/g, '')),
      z.union([z.string().length(14, 'A national ID is 14 digits'), z.null()]),
    )
    .optional(),
  insuranceNo: optionalText,
  jobTitleEn: requiredText('Job title', 200),
  jobTitleAr: optionalText,
  department: optionalText,
  phone: optionalText,
  email: z
    .union([z.string().trim().email('Enter a valid email address'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  hiredOn: dateOnly,
  dailyRate: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? null : v),
    z.union([z.coerce.number().nonnegative('A daily rate cannot be negative'), z.null()]),
  ),
});

const createEmployeeAction = action({
  permission: 'employees.manage',
  input: employeeSchema,
  handler: async (input, { actor }) => {
    const employee = await createEmployee({ actor, input });
    revalidatePath('/employees');
    return { id: employee.id, code: employee.code };
  },
});

const updateEmployeeAction = action({
  permission: 'employees.manage',
  input: employeeSchema.partial().extend({ employeeId: id, code: requiredText('Employee code', 32) }),
  handler: async ({ employeeId, ...input }, { actor }) => {
    const employee = await updateEmployee({ actor, employeeId, input });
    revalidatePath('/employees');
    return { id: employee.id };
  },
});

const archiveEmployeeAction = action({
  permission: 'employees.manage',
  input: z.object({ employeeId: id }),
  handler: async ({ employeeId }, { actor }) => {
    await archiveEmployee({ actor, employeeId });
    revalidatePath('/employees');
    return { archived: true as const };
  },
});

/* ============================================================
   FORM ADAPTERS
   ============================================================ */

export async function submitCreateEmployee(_previous: unknown, formData: FormData) {
  return createEmployeeAction(formToObject(formData));
}

export async function submitUpdateEmployee(_previous: unknown, formData: FormData) {
  return updateEmployeeAction(formToObject(formData));
}

export async function submitArchiveEmployee(_previous: unknown, formData: FormData) {
  return archiveEmployeeAction(formToObject(formData));
}
