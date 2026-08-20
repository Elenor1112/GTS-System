'use server';

import { revalidatePath } from 'next/cache';

import { action, formToObject } from '@/lib/action';
import { requireActor } from '@/lib/auth';
import { db } from '@/lib/db';
import { requestLeave, approveLeave, rejectLeave, cancelLeave } from '@/lib/services/leave';

import { requestSchema, decisionSchema, cancelSchema } from './schemas';

/**
 * Leave actions.
 *
 * The interesting authorization is not the permission — it is WHOSE
 * leave. `leave.request` lets you request your own; requesting on
 * somebody else's behalf needs `leave.manage`, and that distinction is
 * enforced here rather than assumed from the form.
 */

const requestLeaveAction = action({
  permission: 'leave.request',
  input: requestSchema,
  handler: async (input, { actor }) => {
    /*
     * Whose leave is this?
     *
     * Default to the actor's own employee record. A different employeeId
     * is only honoured for somebody who may manage leave — otherwise any
     * signed-in user could spend a colleague's balance.
     */
    let employeeId = actor.employeeId;

    if (input.employeeId && input.employeeId !== actor.employeeId) {
      const manager = await requireActor();
      const mayManage =
        manager.isAdmin || manager.permissions.includes('leave.manage');
      if (!mayManage) {
        throw new Error('You can only request leave for yourself.');
      }
      employeeId = input.employeeId;
    }

    if (!employeeId) {
      throw new Error('Your login is not linked to an employee record.');
    }

    const request = await requestLeave({
      actor,
      employeeId,
      leaveTypeId: input.leaveTypeId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      reason: input.reason ?? null,
    });

    revalidatePath('/leave');
    revalidatePath('/dashboard');
    return { id: request.id, ref: request.ref, workingDays: request.workingDays.toString() };
  },
});

const approveLeaveAction = action({
  permission: 'leave.approve',
  input: decisionSchema,
  handler: async ({ requestId, note }, { actor }) => {
    const request = await approveLeave({ actor, requestId, note: note ?? undefined });
    revalidatePath('/leave');
    revalidatePath('/dashboard');
    return { ref: request.ref };
  },
});

const rejectLeaveAction = action({
  permission: 'leave.approve',
  input: decisionSchema.extend({ note: decisionSchema.shape.note }),
  handler: async ({ requestId, note }, { actor }) => {
    if (!note?.trim()) {
      throw new Error('Rejecting a leave request must say why.');
    }
    const request = await rejectLeave({ actor, requestId, note });
    revalidatePath('/leave');
    revalidatePath('/dashboard');
    return { ref: request.ref };
  },
});

const cancelLeaveAction = action({
  // No permission key: cancelling YOUR OWN request is not an
  // administrative act. The ownership check below is the real control.
  input: cancelSchema,
  handler: async ({ requestId, note }, { actor }) => {
    const request = await db.leaveRequest.findUnique({
      where: { id: requestId },
      select: { employeeId: true, ref: true },
    });
    if (!request) throw new Error('That leave request does not exist.');

    const isOwn = request.employeeId === actor.employeeId;
    const mayManage = actor.isAdmin || actor.permissions.includes('leave.approve');

    if (!isOwn && !mayManage) {
      throw new Error('You can only cancel your own leave request.');
    }

    const cancelled = await cancelLeave({ actor, requestId, note: note ?? undefined });
    revalidatePath('/leave');
    return { ref: cancelled.ref };
  },
});

/* ---- Form adapters ---- */

export async function submitRequestLeave(_previous: unknown, formData: FormData) {
  return requestLeaveAction(formToObject(formData));
}

/**
 * One endpoint for the approval queue's three buttons, dispatched on the
 * submit button's own `intent`, so a row of actions is one form.
 */
export async function submitLeaveDecision(_previous: unknown, formData: FormData) {
  const data = formToObject(formData);

  switch (data.intent) {
    case 'approve':
      return approveLeaveAction(data);
    case 'reject':
      return rejectLeaveAction(data);
    case 'cancel':
      return cancelLeaveAction(data);
    default:
      return {
        ok: false as const,
        code: 'UNKNOWN_INTENT',
        message: 'That action is not available.',
      };
  }
}
