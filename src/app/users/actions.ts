'use server';

import { revalidatePath } from 'next/cache';

import { action, formToObject } from '@/lib/action';
import { createUser, updateUser, setUserActive, resetPassword } from '@/lib/services/people';

import { newUserSchema, updateUserSchema, activeSchema, resetSchema } from './schemas';

/**
 * User administration.
 *
 * Every one requires `users.manage`. The rules that stop somebody
 * locking the organisation out of its own system — the last
 * administrator cannot be demoted or deactivated — live in the service,
 * so they hold no matter which caller reaches them.
 */

const createUserAction = action({
  permission: 'users.manage',
  input: newUserSchema,
  handler: async (input, { actor }) => {
    const user = await createUser({
      actor,
      input: {
        email: input.email,
        nameEn: input.nameEn,
        nameAr: input.nameAr,
        phone: input.phone,
        roleId: input.roleId,
        password: input.password,
      },
    });
    revalidatePath('/users');
    return { id: user.id, email: user.email };
  },
});

const updateUserAction = action({
  permission: 'users.manage',
  input: updateUserSchema,
  handler: async ({ userId, ...input }, { actor }) => {
    const user = await updateUser({ actor, userId, input });
    revalidatePath('/users');
    return { id: user.id };
  },
});

const setActiveAction = action({
  permission: 'users.manage',
  input: activeSchema,
  handler: async ({ userId, isActive }, { actor }) => {
    const user = await setUserActive({ actor, userId, isActive });
    revalidatePath('/users');
    return { isActive: user.isActive };
  },
});

const resetPasswordAction = action({
  permission: 'users.manage',
  input: resetSchema,
  handler: async ({ userId, password }, { actor }) => {
    await resetPassword({ actor, userId, password });
    revalidatePath('/users');
    return { reset: true as const };
  },
});

/* ---- Form adapters ---- */

export async function submitNewUser(_previous: unknown, formData: FormData) {
  return createUserAction(formToObject(formData));
}

/**
 * One endpoint for the per-row controls, dispatched on `intent` so a
 * table row is a single form rather than three nested ones.
 */
export async function submitUserAction(_previous: unknown, formData: FormData) {
  const data = formToObject(formData);

  switch (data.intent) {
    case 'role':
      return updateUserAction(data);
    case 'deactivate':
      return setActiveAction({ ...data, isActive: false });
    case 'activate':
      return setActiveAction({ ...data, isActive: true });
    case 'reset':
      return resetPasswordAction(data);
    default:
      return {
        ok: false as const,
        code: 'UNKNOWN_INTENT',
        message: 'That action is not available.',
      };
  }
}
