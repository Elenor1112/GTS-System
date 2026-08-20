'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { action } from '@/lib/action';
import { checkIn, checkOut } from '@/lib/services/attendance';
import { id } from '@/lib/action';

/**
 * Attendance actions.
 *
 * Note what the schemas ACCEPT: a project, a coordinate pair and an
 * accuracy figure. There is no `distance`, no `accepted`, no `status`.
 * A client cannot assert its own verdict because there is no field in
 * which to assert it — the server computes all three from the
 * coordinates against the project location an administrator set.
 */

const coordinate = z.coerce
  .number()
  .refine(Number.isFinite, 'That is not a usable coordinate');

const checkInSchema = z.object({
  projectId: id,
  latitude: coordinate.refine((v) => v >= -90 && v <= 90, 'Latitude must be between −90 and 90'),
  longitude: coordinate.refine(
    (v) => v >= -180 && v <= 180,
    'Longitude must be between −180 and 180',
  ),
  /** The browser's own uncertainty. Optional: some devices omit it. */
  accuracy: z.coerce.number().nonnegative().optional().nullable(),
});

const checkInAction = action({
  // Every signed-in employee may check themselves in; the check that
  // matters is the ASSIGNMENT, enforced inside the service.
  permission: 'attendance.check_in',
  input: checkInSchema,
  handler: async (input, { actor }) => {
    if (!actor.employeeId) {
      // Thrown rather than returned, so it travels the same path as any
      // other refusal and cannot be mistaken for success.
      throw new Error('Your login is not linked to an employee record.');
    }

    const result = await checkIn({
      actor: { id: actor.id, email: actor.email },
      employeeId: actor.employeeId,
      projectId: input.projectId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
    });

    revalidatePath('/attendance');
    revalidatePath('/dashboard');

    return {
      id: result.attendance.id,
      status: result.attendance.status,
      distanceMetres: result.attendance.distanceMetres,
      minutesLate: result.attendance.minutesLate,
    };
  },
});

const checkOutSchema = z.object({
  projectId: id,
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
});

const checkOutAction = action({
  permission: 'attendance.check_in',
  input: checkOutSchema,
  handler: async (input, { actor }) => {
    if (!actor.employeeId) {
      throw new Error('Your login is not linked to an employee record.');
    }

    const record = await checkOut({
      actor: { id: actor.id, email: actor.email },
      employeeId: actor.employeeId,
      projectId: input.projectId,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    });

    revalidatePath('/attendance');

    return { id: record.id, workedMinutes: record.workedMinutes };
  },
});


/** Callable form of `checkInAction`, exported because a 'use server' module
 *  may export only async functions. */
export async function submitCheckIn(input: unknown) {
  return checkInAction(input);
}

/** Callable form of `checkOutAction`, exported because a 'use server' module
 *  may export only async functions. */
export async function submitCheckOut(input: unknown) {
  return checkOutAction(input);
}
