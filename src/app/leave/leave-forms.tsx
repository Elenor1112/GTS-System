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
export interface RequestLeaveDict {
  typeLabel: string;
  typePlaceholder: string;
  firstDayLabel: string;
  lastDayLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  submit: string;
  submitting: string;
  allWeekend: string;
  workingDaysNote: string;
  successMessage: string;
}

export function RequestLeaveForm({
  leaveTypes,
  dict,
}: {
  leaveTypes: { id: string; label: string }[];
  dict: RequestLeaveDict;
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
          {dict.successMessage
            .replace('{ref}', String(state.data.ref))
            .replace('{days}', String(state.data.workingDays))}
        </p>
      )}

      <div className="gts-field" style={{ flex: '1 1 14rem' }}>
        <label className="gts-label" htmlFor="leaveTypeId">
          {dict.typeLabel} <span className="gts-required">*</span>
        </label>
        <select
          id="leaveTypeId"
          name="leaveTypeId"
          required
          defaultValue=""
          className="gts-input gts-select"
          aria-invalid={e('leaveTypeId') ? true : undefined}
        >
          <option value="">{dict.typePlaceholder}</option>
          {leaveTypes.map((lt) => (
            <option key={lt.id} value={lt.id}>
              {lt.label}
            </option>
          ))}
        </select>
        {e('leaveTypeId') && <p className="gts-help gts-help-error">{e('leaveTypeId')}</p>}
      </div>

      <div className="gts-field">
        <label className="gts-label" htmlFor="startsOn">
          {dict.firstDayLabel} <span className="gts-required">*</span>
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
          {dict.lastDayLabel} <span className="gts-required">*</span>
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
          {dict.reasonLabel}
        </label>
        <input id="reason" name="reason" className="gts-input" placeholder={dict.reasonPlaceholder} />
      </div>

      <FormActions>
        <Submit variant="accent" pendingLabel={dict.submitting}>
          {dict.submit}
        </Submit>
        {days !== null && (
          <p className="gts-meta" style={{ alignSelf: 'center' }}>
            {days === 0
              ? dict.allWeekend
              : dict.workingDaysNote
                  .replace('{days}', String(days))
                  .replace('{plural}', days === 1 ? '' : 's')}
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
export interface DecisionDict {
  rejectReasonPlaceholder: string;
  rejectReasonLabel: string;
  reject: string;
  cancel: string;
  approve: string;
  deciding: string;
}

export function DecisionButtons({
  requestId,
  reference,
  ownOnly = false,
  dict,
}: {
  requestId: string;
  reference: string;
  ownOnly?: boolean;
  dict: DecisionDict;
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
          placeholder={dict.rejectReasonPlaceholder.replace('{reference}', reference)}
          aria-label={dict.rejectReasonLabel.replace('{reference}', reference)}
        />
        <Submit variant="primary" pendingLabel={dict.deciding}>
          {dict.reject}
        </Submit>
        <button type="button" className="gts-btn gts-btn-ghost gts-btn-sm" onClick={() => setRejecting(false)}>
          {dict.cancel}
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="gts-decision-actions">
      <input type="hidden" name="requestId" value={requestId} />

      {ownOnly ? (
        <button type="submit" name="intent" value="cancel" className="gts-btn gts-btn-ghost gts-btn-sm">
          {dict.cancel}
        </button>
      ) : (
        <>
          <button type="submit" name="intent" value="approve" className="gts-btn gts-btn-accent gts-btn-sm">
            {dict.approve}
          </button>
          <button
            type="button"
            className="gts-btn gts-btn-secondary gts-btn-sm"
            onClick={() => setRejecting(true)}
          >
            {dict.reject}
          </button>
        </>
      )}

      {state && !state.ok && <p className="gts-help gts-help-error">{state.message}</p>}
    </form>
  );
}
