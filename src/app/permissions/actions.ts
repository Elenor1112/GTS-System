'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, id } from '@/lib/action';
import { setRolePermissions, createRole } from '@/lib/services/people';

/**
 * Role and permission administration.
 *
 * Changing what a role may do is a security event, so every one of these
 * writes a PERMISSION_CHANGE audit entry recording exactly which keys
 * were granted and which revoked — not merely that "permissions changed".
 */

const setPermissionsAction = action({
  permission: 'roles.manage',
  input: z.object({
    roleId: id,
    /* A single checked box posts a string; several post an array. */
    permissionKeys: z.preprocess(
      (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]),
      z.array(z.string()),
    ),
  }),
  handler: async ({ roleId, permissionKeys }, { actor }) => {
    const result = await setRolePermissions({ actor, roleId, permissionKeys });
    revalidatePath('/permissions');
    revalidatePath('/users');
    return { count: result.count };
  },
});

const createRoleAction = action({
  permission: 'roles.manage',
  input: z.object({
    key: z
      .string()
      .trim()
      .min(2, 'A role key is required')
      .max(32)
      .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, digits and underscores'),
    nameEn: z.string().trim().min(1, 'A name is required').max(100),
    nameAr: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(300).optional().nullable(),
  }),
  handler: async (input, { actor }) => {
    const role = await createRole({ actor, input });
    revalidatePath('/permissions');
    return { id: role.id, nameEn: role.nameEn };
  },
});

export async function submitRolePermissions(_previous: unknown, formData: FormData) {
  return setPermissionsAction(formToObject(formData));
}

export async function submitNewRole(_previous: unknown, formData: FormData) {
  return createRoleAction(formToObject(formData));
}
