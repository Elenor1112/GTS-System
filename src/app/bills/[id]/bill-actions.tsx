'use client';

import { useActionState, useState } from 'react';

import { FormError, Submit, errorFor } from '@/components/form';
import type { Dictionary } from '@/lib/i18n';
import { PAYMENT_METHODS } from './payment-methods';

import { submitBillWorkflow, submitPayment } from '../actions';

type WorkflowDict = Dictionary['finance']['bills']['workflow'];
type PaymentsDict = Omit<Dictionary['finance']['bills']['detail']['payments'], 'title'>;
type PaymentMethodsDict = Dictionary['finance']['bills']['paymentMethods'];
type StatusDict = Dictionary['finance']['bills']['status'];

/**
 * The bill workflow controls.
 *
 * Only the transitions the actor may actually take are rendered — the
 * page decides that from `canTransition()` and the actor's permissions,
 * so this component never offers a button the server would refuse.
 *
 * Rejecting and cancelling require a reason, so those open a small
 * disclosure rather than firing on one click: a status change nobody
 * explained is one nobody can audit later.
 */
export function BillWorkflow({
  billId,
  number,
  canSubmit,
  canApprove,
  canSend,
  canCancel,
  dict,
}: {
  billId: string;
  number: string;
  canSubmit: boolean;
  canApprove: boolean;
  canSend: boolean;
  canCancel: boolean;
  dict: WorkflowDict;
}) {
  const [state, formAction] = useActionState(submitBillWorkflow, null);
  const [reasonFor, setReasonFor] = useState<'reject' | 'cancel' | null>(null);

  return (
    <section className="gts-workflow">
      <FormError state={state} />

      {reasonFor ? (
        <form action={formAction} className="gts-workflow-reason">
          <input type="hidden" name="billId" value={billId} />
          <input type="hidden" name="intent" value={reasonFor} />

          <div className="gts-field" style={{ flex: '1 1 20rem' }}>
            <label className="gts-label" htmlFor="note">
              {dict.whyPrefix} {number} {reasonFor === 'reject' ? dict.beingRejected : dict.beingCancelled}
            </label>
            <input
              id="note"
              name="note"
              required
              autoFocus
              className="gts-input"
              placeholder={
                reasonFor === 'reject'
                  ? dict.rejectPlaceholder
                  : dict.cancelPlaceholder
              }
              aria-invalid={errorFor(state, 'note') ? true : undefined}
            />
            {errorFor(state, 'note') && (
              <p className="gts-help gts-help-error">{errorFor(state, 'note')}</p>
            )}
          </div>

          <Submit variant={reasonFor === 'cancel' ? 'danger' : 'primary'} pendingLabel={dict.recording}>
            {reasonFor === 'reject' ? dict.reject : dict.cancelBill}
          </Submit>
          <button
            type="button"
            className="gts-btn gts-btn-ghost"
            onClick={() => setReasonFor(null)}
          >
            {dict.neverMind}
          </button>
        </form>
      ) : (
        <form action={formAction} className="gts-workflow-actions">
          <input type="hidden" name="billId" value={billId} />

          {canSubmit && (
            <button type="submit" name="intent" value="submit" className="gts-btn gts-btn-accent">
              {dict.submitForApproval}
            </button>
          )}
          {canApprove && (
            <>
              <button type="submit" name="intent" value="approve" className="gts-btn gts-btn-accent">
                {dict.approve}
              </button>
              <button
                type="button"
                className="gts-btn gts-btn-secondary"
                onClick={() => setReasonFor('reject')}
              >
                {dict.reject}
              </button>
            </>
          )}
          {canSend && (
            <button type="submit" name="intent" value="send" className="gts-btn gts-btn-primary">
              {dict.markSent}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              className="gts-btn gts-btn-danger"
              onClick={() => setReasonFor('cancel')}
            >
              {dict.cancel}
            </button>
          )}
        </form>
      )}
    </section>
  );
}

/**
 * Record a payment.
 *
 * The amount defaults to what is actually outstanding — total minus
 * withholding minus what has already been paid — because that is the
 * figure being settled in the overwhelming majority of cases, and the
 * server refuses anything larger.
 */
export function PaymentForm({
  billId,
  outstanding,
  suggestedWht,
  dict,
  paymentMethods,
  statuses,
}: {
  billId: string;
  outstanding: string;
  suggestedWht: string;
  dict: PaymentsDict;
  paymentMethods: PaymentMethodsDict;
  statuses: StatusDict;
}) {
  const [state, formAction] = useActionState(submitPayment, null);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const methodLabel = (value: (typeof PAYMENT_METHODS)[number]['value']) =>
    ({
      BANK_TRANSFER: paymentMethods.bankTransfer,
      CHEQUE: paymentMethods.cheque,
      CASH: paymentMethods.cash,
      CARD: paymentMethods.card,
      OTHER: paymentMethods.other,
    })[value];

  if (!open) {
    return (
      <div className="gts-payment-trigger">
        <button type="button" className="gts-btn gts-btn-accent" onClick={() => setOpen(true)}>
          {dict.recordPayment}
        </button>
        <span className="gts-meta">
          {outstanding} {dict.outstandingSuffix}
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className="gts-payment-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          {dict.form.successPrefix} {String(state.data.ref)} {dict.form.successNowStatus}{' '}
          {statuses[
            String(state.data.status)
              .toLowerCase()
              .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof StatusDict
          ] ?? String(state.data.status).toLowerCase().replace('_', ' ')}.
        </p>
      )}

      <input type="hidden" name="billId" value={billId} />

      <div className="gts-field">
        <label className="gts-label" htmlFor="amount">
          {dict.form.amountLabel} <span className="gts-required">*</span>
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          required
          defaultValue={outstanding}
          className="gts-input gts-input-num"
          aria-invalid={errorFor(state, 'amount') ? true : undefined}
        />
        {errorFor(state, 'amount') && (
          <p className="gts-help gts-help-error">{errorFor(state, 'amount')}</p>
        )}
      </div>

      <div className="gts-field">
        <label className="gts-label" htmlFor="whtDeducted">
          {dict.form.withholdingLabel}
        </label>
        <input
          id="whtDeducted"
          name="whtDeducted"
          type="number"
          step="0.01"
          defaultValue={suggestedWht}
          className="gts-input gts-input-num"
        />
        <p className="gts-help">{dict.form.withholdingHint}</p>
      </div>

      <div className="gts-field">
        <label className="gts-label" htmlFor="method">
          {dict.form.methodLabel}
        </label>
        <select id="method" name="method" defaultValue="BANK_TRANSFER" className="gts-input gts-select">
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {methodLabel(m.value)}
            </option>
          ))}
        </select>
      </div>

      <div className="gts-field">
        <label className="gts-label" htmlFor="receivedOn">
          {dict.form.receivedOnLabel} <span className="gts-required">*</span>
        </label>
        <input
          id="receivedOn"
          name="receivedOn"
          type="date"
          required
          defaultValue={today}
          className="gts-input"
        />
      </div>

      <div className="gts-field" style={{ flex: '1 1 12rem' }}>
        <label className="gts-label" htmlFor="reference">
          {dict.form.bankReferenceLabel}
        </label>
        <input id="reference" name="reference" className="gts-input" placeholder={dict.form.bankReferencePlaceholder} />
      </div>

      <div className="gts-payment-form-actions">
        <Submit variant="accent" pendingLabel={dict.form.recording}>
          {dict.form.recordPayment}
        </Submit>
        <button type="button" className="gts-btn gts-btn-ghost" onClick={() => setOpen(false)}>
          {dict.form.cancel}
        </button>
      </div>
    </form>
  );
}
