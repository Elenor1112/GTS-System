'use client';

import { useActionState } from 'react';

import { FormError, Submit, errorFor } from '@/components/form';
import { Icon } from '@/components/icon';
import type { OperationsDict } from '@/lib/i18n/dict/operations';

import { submitAssignEmployee, submitReleaseEmployee } from '../actions';

export type AssignFormDict = OperationsDict['operations']['projects']['assign'];

/**
 * Assign somebody to the site, and release them from it.
 *
 * The warning after a successful assignment is the useful part: a person
 * assigned to a project with no pinned coordinates has nowhere to check
 * in, and telling them so at the moment of assignment is better than
 * their discovering it outdoors on a phone at 07:30.
 */
export function AssignForm({
  projectId,
  candidates,
  hasLocation,
  dict,
}: {
  projectId: string;
  candidates: { id: string; code: string; nameEn: string; jobTitleEn: string }[];
  hasLocation: boolean;
  dict: AssignFormDict;
}) {
  const [state, formAction] = useActionState(submitAssignEmployee, null);

  if (candidates.length === 0) {
    return (
      <p className="gts-meta">
        {dict.allAssigned}
      </p>
    );
  }

  return (
    <form action={formAction} className="gts-assign-form mb-4">
      <FormError state={state} />
      {state?.ok && (
        <p
          className={
            hasLocation
              ? 'w-full px-4 py-3 rounded-sm bg-success-bg border border-success-br text-success text-sm'
              : 'w-full px-4 py-3 rounded-sm bg-danger-bg border border-danger-br text-danger text-sm'
          }
          role="status"
        >
          {hasLocation ? dict.assignedWithLocation : dict.assignedWithoutLocation}
        </p>
      )}

      <input type="hidden" name="projectId" value={projectId} />

      <div className="gts-field" style={{ flex: '1 1 14rem' }}>
        <label className="gts-label" htmlFor="employeeId">
          {dict.employeeLabel}
        </label>
        <select
          id="employeeId"
          name="employeeId"
          required
          className="gts-input gts-select"
          defaultValue=""
          aria-invalid={errorFor(state, 'employeeId') ? true : undefined}
        >
          <option value="">{dict.employeePlaceholder}</option>
          {candidates.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.nameEn} — {employee.jobTitleEn}
            </option>
          ))}
        </select>
      </div>

      <div className="gts-field" style={{ flex: '1 1 12rem' }}>
        <label className="gts-label" htmlFor="roleOnSite">
          {dict.roleOnSiteLabel}
        </label>
        <input
          id="roleOnSite"
          name="roleOnSite"
          className="gts-input"
          placeholder={dict.roleOnSitePlaceholder}
        />
      </div>

      <Submit variant="primary" pendingLabel={dict.assigning}>
        {dict.assign}
      </Submit>
    </form>
  );
}

/** Ends an assignment. A button rather than a link: it changes state. */
export function ReleaseButton({
  assignmentId,
  projectId,
  name,
  dict,
}: {
  assignmentId: string;
  projectId: string;
  name: string;
  dict: AssignFormDict;
}) {
  const [state, formAction] = useActionState(submitReleaseEmployee, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        className="h-touch px-2 inline-flex items-center text-xs font-medium text-fg-secondary hover:text-fg transition-colors"
        aria-label={dict.releaseAria.replace('{name}', name)}
      >
        <Icon name="person_remove" size={16} />
        {dict.release}
      </button>
      {state && !state.ok && (
        <p className="gts-help gts-help-error">{state.message}</p>
      )}
    </form>
  );
}
