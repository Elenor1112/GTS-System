'use server';

import { revalidatePath } from 'next/cache';

import { action, formToObject } from '@/lib/action';
import { setSetting } from '@/lib/services/settings';

import { settingsSchema } from './schemas';

/**
 * Organisation settings.
 *
 * Each key is written individually so the audit log records which value
 * changed and what it was before — a single "settings updated" entry
 * would not tell anybody that the geofence radius went from 200m to
 * 5,000m, which is precisely the change worth being able to find later.
 */

const saveSettingsAction = action({
  permission: 'settings.manage',
  input: settingsSchema,
  handler: async (input, { actor }) => {
    const changed: string[] = [];

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      await setSetting({ actor, key, value });
      changed.push(key);
    }

    revalidatePath('/admin');
    // Attendance and billing both read these on every request.
    revalidatePath('/attendance');
    revalidatePath('/bills');

    return { changed: changed.length };
  },
});

export async function submitSettings(_previous: unknown, formData: FormData) {
  return saveSettingsAction(formToObject(formData));
}
