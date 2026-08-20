'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action, formToObject, id } from '@/lib/action';
import { markRead, markAllRead } from '@/lib/services/notifications';

/**
 * Notification actions.
 *
 * No permission key: these act on YOUR OWN notifications. The service
 * scopes every write by the actor's user id, so a guessed notification
 * id cannot mark somebody else's as read.
 */

const markReadAction = action({
  input: z.object({ notificationId: id }),
  handler: async ({ notificationId }, { actor }) => {
    await markRead(actor.id, notificationId);
    revalidatePath('/notifications');
    return { read: true as const };
  },
});

const markAllReadAction = action({
  input: z.object({}),
  handler: async (_input, { actor }) => {
    const count = await markAllRead(actor.id);
    revalidatePath('/notifications');
    revalidatePath('/dashboard');
    return { count };
  },
});

export async function submitMarkRead(_previous: unknown, formData: FormData) {
  return markReadAction(formToObject(formData));
}

export async function submitMarkAllRead(_previous: unknown, formData: FormData) {
  return markAllReadAction(formToObject(formData));
}
