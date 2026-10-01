import 'server-only';

import type { BillStatus } from '@prisma/client';

import { db, transaction } from '../db';
import { writeAudit } from './audit';
import { validateBillForIssue, type ActorRef } from './billing';
import { organisation } from './settings';
import { buildEtaDocument, signEtaDocument } from './eta-document';
import {
  EtaError, cancelDocument, flattenEtaErrors, getDocumentDetails, submitDocuments,
  type DocumentDetails,
} from './eta-client';

/**
 * GTS — submitting bills to the Egyptian Tax Authority.
 *
 * Every ETA identifier written here came back from the ETA. The network
 * call runs OUTSIDE any database transaction — a serializable transaction
 * held open across a slow government endpoint would block every other
 * write to the bill — and the result is recorded afterwards in one short
 * update.
 */

/** Issued, receivable bills are ours to report. A payable bill is the vendor's. */
const SUBMITTABLE_STATUSES: BillStatus[] = ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
const RESUBMITTABLE_ETA = ['NOT_SUBMITTED', 'INVALID'];

export function canSubmitToEta(bill: { direction: string; status: BillStatus; etaStatus: string }): boolean {
  return (
    bill.direction === 'RECEIVABLE' &&
    SUBMITTABLE_STATUSES.includes(bill.status) &&
    RESUBMITTABLE_ETA.includes(bill.etaStatus)
  );
}

async function loadBill(billId: string) {
  const bill = await db.electronicBill.findFirst({
    where: { id: billId, deletedAt: null },
    include: { items: { orderBy: { sortOrder: 'asc' } }, client: true },
  });
  if (!bill) throw new EtaError('NOT_FOUND', 'That bill does not exist.');
  return bill;
}

export async function submitBillToEta(params: { actor: ActorRef; billId: string }) {
  const bill = await loadBill(params.billId);

  if (!canSubmitToEta(bill)) {
    throw new EtaError(
      'NOT_SUBMITTABLE',
      bill.direction !== 'RECEIVABLE'
        ? 'Only sales invoices are submitted to the ETA; a purchase bill is submitted by the vendor.'
        : `${bill.number} cannot be submitted while it is ${bill.status.toLowerCase().replace('_', ' ')} with ETA status ${bill.etaStatus}.`,
    );
  }

  const problems = await transaction((tx) => validateBillForIssue(tx, bill.id));
  const org = await organisation();
  if (!/^\d{9}$/.test(org.trn.replace(/\D/g, ''))) {
    problems.push('The company tax registration number is not set in Administration.');
  }
  if (!org.activityCode) {
    problems.push('The company ETA activity code is not set in Administration.');
  }
  if (problems.length) {
    throw new EtaError('NOT_READY', problems.join(' '), { problems });
  }

  const document = await signEtaDocument(
    buildEtaDocument({
      bill,
      issuer: { ...org, governorateCode: org.governorateCode },
      receiver: {
        nameEn: bill.client!.nameEn,
        nameAr: bill.client!.nameAr,
        trn: bill.client!.trn!,
        addressLine: bill.client!.addressLine,
        governorateCode: bill.client!.governorateCode,
      },
    }),
  );

  const result = await submitDocuments([document]);
  const accepted = result.acceptedDocuments[0];
  const rejected = result.rejectedDocuments[0];
  const now = new Date();

  const data = accepted
    ? {
        etaStatus: 'SUBMITTED',
        etaUuid: accepted.uuid,
        etaLongId: accepted.longId,
        etaSubmissionId: result.submissionId,
        etaSubmittedAt: now,
        etaErrors: [],
      }
    : {
        etaStatus: 'INVALID',
        etaSubmissionId: result.submissionId,
        etaErrors: rejected ? flattenEtaErrors(rejected.error) : ['The ETA accepted no document.'],
      };

  await recordEta(params.actor, bill, data, accepted
    ? `${bill.number}: submitted to the ETA as ${accepted.uuid}`
    : `${bill.number}: rejected by the ETA on submission`, 'SEND');

  return { status: data.etaStatus, uuid: accepted?.uuid ?? null, errors: data.etaErrors };
}

/** Map the ETA's document status onto ours. */
export function mapEtaStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'valid': return 'VALID';
    case 'invalid': return 'INVALID';
    case 'cancelled': return 'CANCELLED';
    case 'rejected': return 'REJECTED';
    default: return 'SUBMITTED';
  }
}

/** The failed validation steps in a document's details, as readable lines. */
export function validationErrors(details: DocumentDetails): string[] {
  const steps = details.validationResults?.validationSteps ?? [];
  return steps
    .filter((step) => step.status?.toLowerCase() === 'invalid')
    .flatMap((step) => {
      const messages = flattenEtaErrors(step.error);
      return messages.length ? messages : [step.name ?? 'Validation step failed'];
    });
}

export async function refreshEtaStatus(params: { actor: ActorRef; billId: string }) {
  const bill = await loadBill(params.billId);
  if (!bill.etaUuid) {
    throw new EtaError('NOT_SUBMITTED', `${bill.number} has not been submitted to the ETA.`);
  }

  const details = await getDocumentDetails(bill.etaUuid);
  const status = mapEtaStatus(details.status);
  const errors = status === 'INVALID' ? validationErrors(details) : [];

  await recordEta(params.actor, bill, {
    etaStatus: status,
    etaLongId: details.longId ?? bill.etaLongId,
    etaErrors: errors,
  }, `${bill.number}: ETA status ${status}`, 'UPDATE');

  return { status, errors };
}

/**
 * Cancel a valid document on the ETA.
 *
 * Only the ETA can cancel what it has validated, and only within its own
 * window (currently seven days) — past that, its refusal is shown as-is.
 * The bill's own workflow status is untouched: cancelling it internally
 * is a separate, deliberate step.
 */
export async function cancelEtaDocument(params: { actor: ActorRef; billId: string; reason: string }) {
  const bill = await loadBill(params.billId);
  if (!bill.etaUuid || bill.etaStatus !== 'VALID') {
    throw new EtaError('NOT_CANCELLABLE', 'Only a document the ETA has validated can be cancelled there.');
  }

  await cancelDocument(bill.etaUuid, params.reason);
  await recordEta(params.actor, bill, { etaStatus: 'CANCELLED' },
    `${bill.number}: cancelled on the ETA (${params.reason})`, 'CANCEL');

  return { status: 'CANCELLED' };
}

async function recordEta(
  actor: ActorRef,
  bill: { id: string; etaStatus: string; etaUuid: string | null },
  data: Record<string, unknown>,
  summary: string,
  action: 'SEND' | 'UPDATE' | 'CANCEL',
) {
  await transaction(async (tx) => {
    await tx.electronicBill.update({
      where: { id: bill.id },
      data: { ...data, etaCheckedAt: new Date() },
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorEmail: actor.email,
        action,
        entityType: 'ElectronicBill',
        entityId: bill.id,
        summary,
        beforeState: { etaStatus: bill.etaStatus, etaUuid: bill.etaUuid },
        afterState: { etaStatus: data.etaStatus, etaUuid: data.etaUuid ?? bill.etaUuid },
      },
      tx,
    );
  });
}
