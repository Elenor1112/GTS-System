'use server';

import { revalidatePath } from 'next/cache';

import { action, formToObject, formToArray } from '@/lib/action';
import {
  createBill, updateBillLines, submitForApproval, approveBill,
  rejectBill, sendBill, cancelBill, recordPayment,
} from '@/lib/services/billing';

import {
  createBillSchema, updateLinesSchema, withNoteSchema, withReasonSchema, paymentSchema,
} from './schemas';

/**
 * Bill actions.
 *
 * A `'use server'` module may export ONLY async functions — Next turns
 * every export into a callable endpoint. The Zod schemas therefore live
 * in ./schemas.ts rather than here.
 */

const createBillAction = action({
  permission: 'bills.create',
  input: createBillSchema,
  handler: async (input, { actor }) => {
    const bill = await createBill({
      actor,
      direction: input.direction,
      clientId: input.direction === 'RECEIVABLE' ? input.clientId : null,
      vendorId: input.direction === 'PAYABLE' ? input.vendorId : null,
      projectId: input.projectId || null,
      issuedOn: input.issuedOn,
      dueOn: input.dueOn,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      whtRate: input.whtRate,
      notes: input.notes ?? null,
      lines: input.lines,
    });

    revalidatePath('/bills');
    revalidatePath('/dashboard');
    return { id: bill.id, number: bill.number, total: bill.total.toString() };
  },
});

const updateBillLinesAction = action({
  permission: 'bills.edit',
  input: updateLinesSchema,
  handler: async ({ billId, lines, whtRate }, { actor }) => {
    const bill = await updateBillLines({ actor, billId, lines, whtRate });
    revalidatePath(`/bills/${billId}`);
    return { id: bill.id, total: bill.total.toString() };
  },
});

const submitBillAction = action({
  permission: 'bills.edit',
  input: withNoteSchema,
  handler: async ({ billId, note }, { actor }) => {
    await submitForApproval({ actor, billId, note: note ?? undefined });
    revalidatePath(`/bills/${billId}`);
    revalidatePath('/bills');
    return { submitted: true as const };
  },
});

const approveBillAction = action({
  permission: 'bills.approve',
  input: withNoteSchema,
  handler: async ({ billId, note }, { actor }) => {
    await approveBill({ actor, billId, note: note ?? undefined });
    revalidatePath(`/bills/${billId}`);
    revalidatePath('/bills');
    revalidatePath('/dashboard');
    return { approved: true as const };
  },
});

const rejectBillAction = action({
  permission: 'bills.approve',
  input: withReasonSchema,
  handler: async ({ billId, note }, { actor }) => {
    await rejectBill({ actor, billId, note });
    revalidatePath(`/bills/${billId}`);
    revalidatePath('/bills');
    return { rejected: true as const };
  },
});

const sendBillAction = action({
  permission: 'bills.send',
  input: withNoteSchema,
  handler: async ({ billId, note }, { actor }) => {
    await sendBill({ actor, billId, note: note ?? undefined });
    revalidatePath(`/bills/${billId}`);
    revalidatePath('/bills');
    return { sent: true as const };
  },
});

const cancelBillAction = action({
  permission: 'bills.cancel',
  input: withReasonSchema,
  handler: async ({ billId, note }, { actor }) => {
    await cancelBill({ actor, billId, note });
    revalidatePath(`/bills/${billId}`);
    revalidatePath('/bills');
    return { cancelled: true as const };
  },
});

const recordPaymentAction = action({
  permission: 'payments.record',
  input: paymentSchema,
  handler: async (input, { actor }) => {
    const result = await recordPayment({
      ...input,
      actor,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    });
    revalidatePath(`/bills/${input.billId}`);
    revalidatePath('/bills');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { ref: result.payment.ref, status: result.bill.status };
  },
});

/* ============================================================
   THE EXPORTED ACTIONS

   All async, all reached from a form. The `action()` results above are
   private to this module so the build's "only async exports" rule holds.
   ============================================================ */

/**
 * A bill form posts its lines as `lines[0].quantity`, `lines[1].unitPrice`
 * and so on, which is what lets a multi-line invoice submit without
 * JavaScript. `formToArray` reassembles them.
 */
export async function submitCreateBill(_previous: unknown, formData: FormData) {
  return createBillAction({
    ...formToObject(formData),
    lines: formToArray(formData, 'lines'),
  });
}

export async function submitUpdateBillLines(_previous: unknown, formData: FormData) {
  return updateBillLinesAction({
    ...formToObject(formData),
    lines: formToArray(formData, 'lines'),
  });
}

/**
 * One endpoint for the whole workflow, dispatched on the submit button's
 * own `intent` value. A single form with several buttons is what the
 * platform gives for free, and it keeps the five transitions from
 * drifting apart into five near-identical handlers.
 */
export async function submitBillWorkflow(_previous: unknown, formData: FormData) {
  const data = formToObject(formData);

  switch (data.intent) {
    case 'submit':
      return submitBillAction(data);
    case 'approve':
      return approveBillAction(data);
    case 'reject':
      return rejectBillAction(data);
    case 'send':
      return sendBillAction(data);
    case 'cancel':
      return cancelBillAction(data);
    default:
      return {
        ok: false as const,
        code: 'UNKNOWN_INTENT',
        message: 'That action is not available.',
      };
  }
}

export async function submitPayment(_previous: unknown, formData: FormData) {
  return recordPaymentAction(formToObject(formData));
}
