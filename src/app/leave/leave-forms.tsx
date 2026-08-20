'use client';

import { useActionState, useState } from 'react';

import { FormError, FormActions, Submit, errorFor } from '@/components/form';
import { workingDaysBetween } from './working-days';

import { submitRequestLeave, submitLeaveDecision } from './actions';

/**
 * Requesting leave.
 *
 * The working-day count updates as the dates change, because "four days
 * off" costing two days of entitlement — Thursday to Sunday, with the
 * Egyptian Friday–Saturday weekend in between — surprises people who
 * only see a date range. The server recomputes it regardless.
 */
export function RequestLeaveForm({
  leaveTypes,
}: {
  leaveTypes: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(submitRequestLeave, null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');

  const e = (field: string) => errorFor(state, field);

  const days =
    startsOn && endsOn
      ? workingDaysBetween(new Date(`${startsOn}T00:00:00Z`), new Date(`${endsOn}T00:00:00Z`))
      : null;

  return (
    <form action={formAction} className="gts-request-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          Request {String(state.data.ref)} submitted — {String(state.data.workingDays)} working
          days. Those days are reserved from your balance until it is decided.
        </p>
      )}

      <div className="gts-field" style={{ flex: '1 1 14rem' }}>
        <label className="gts-label" htmlFor="leaveTypeId">
          Type <span className="gts-required">*</span>
        </label>
        <select
          id="leaveTypeId"
          name="leaveTypeId"
          required
          defaultValue=""
          className="gts-input gts-select"
          aria-invalid={e('leaveTypeId') ? true : undefined}
        >
          <option value="">Select a leave type</option>
          {leaveTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {e('leaveTypeId') && <p className="gts-help gts-help-error">{e('leaveTypeId')}</p>}
      </div>

      <div className="gts-field">
        <label className="gts-label" htmlFor="startsOn">
          First day <span className="gts-required">*</span>
        </label>
        <input
          id="startsOn"
          name="startsOn"
          type="date"
          required
          className="gts-input"
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
          aria-invalid={e('startsOn') ? true : undefined}
        />
      </div>

      <div className="gts-field">
        <label className="gts-label" htmlFor="endsOn">
          Last day <span className="gts-required">*</span>
        </label>
        <input
          id="endsOn"
          name="endsOn"
          type="date"
          required
          className="gts-input"
          value={endsOn}
          onChange={(event) => setEndsOn(event.target.value)}
          aria-invalid={e('endsOn') ? true : undefined}
        />
        {e('endsOn') && <p className="gts-help gts-help-error">{e('endsOn')}</p>}
      </div>

      <div className="gts-field" style={{ flex: '1 1 12rem' }}>
        <label className="gts-label" htmlFor="reason">
          Reason
        </label>
        <input id="reason" name="reason" className="gts-input" placeholder="Family visit" />
      </div>

      <FormActions>
        <Submit variant="accent" pendingLabel="Submitting…">
          Request leave
        </Submit>
        {days !== null && (
          <p className="gts-meta" style={{ alignSelf: 'center' }}>
            {days === 0
              ? 'That range is entirely weekend — nothing to request.'
              : `${days} working day${days === 1 ? '' : 's'}. Friday and Saturday are not counted.`}
          </p>
        )}
      </FormActions>
    </form>
  );
}

/**
 * Approve, reject or cancel.
 *
 * Rejecting needs a reason, so it opens a small disclosure rather than
 * firing on one click — a decision nobody explained is one nobody can
 * audit later.
 *
 * `reference` rather than `ref`: React reserves `ref` as a prop name.
 */
export function DecisionButtons({
  requestId,
  reference,
  ownOnly = false,
}: {
  requestId: string;
  reference: string;
  ownOnly?: boolean;
}) {
  const [state, formAction] = useActionState(submitLeaveDecision, null);
  const [rejecting, setRejecting] = useState(false);

  if (rejecting) {
    return (
      <form action={formAction} className="gts-decision-reason">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="intent" value="reject" />
        <input
          name="note"
          required
          autoFocus
          className="gts-input gts-input-sm"
          placeholder={`Why is ${reference} rejected?`}
          aria-label={`Reason for rejecting ${reference}`}
        />
        <Submit variant="primary" pendingLabel="…">
          Reject
        </Submit>
        <button type="button" className="gts-btn gts-btn-ghost gts-btn-sm" onClick={() => setRejecting(false)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="gts-decision-actions">
      <input type="hidden" name="requestId" value={requestId} />

      {ownOnly ? (
        <button type="submit" name="intent" value="cancel" className="gts-btn gts-btn-ghost gts-btn-sm">
          Cancel
        </button>
      ) : (
        <>
          <button type="submit" name="intent" value="approve" className="gts-btn gts-btn-accent gts-btn-sm">
            Approve
          </button>
          <button
            type="button"
            className="gts-btn gts-btn-secondary gts-btn-sm"
            onClick={() => setRejecting(true)}
          >
            Reject
          </button>
        </>
      )}

      {state && !state.ok && <p className="gts-help gts-help-error">{state.message}</p>}
    </form>
  );
}
