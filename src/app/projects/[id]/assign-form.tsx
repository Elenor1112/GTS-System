'use client';

import { useActionState } from 'react';

import { FormError, Submit, errorFor } from '@/components/form';

import { submitAssignEmployee, submitReleaseEmployee } from '../actions';

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
}: {
  projectId: string;
  candidates: { id: string; code: string; nameEn: string; jobTitleEn: string }[];
  hasLocation: boolean;
}) {
  const [state, formAction] = useActionState(submitAssignEmployee, null);

  if (candidates.length === 0) {
    return (
      <p className="gts-meta">
        Every active employee is already assigned to this project.
      </p>
    );
  }

  return (
    <form action={formAction} className="gts-assign-form">
      <FormError state={state} />
      {state?.ok && (
        <p className={hasLocation ? 'gts-form-success' : 'gts-form-error'} role="status">
          {hasLocation
            ? 'Assigned. They can check in at this site from the Attendance screen.'
            : 'Assigned — but this project has no site location, so they cannot check in yet. Set the location above.'}
        </p>
      )}

      <input type="hidden" name="projectId" value={projectId} />

      <div className="gts-field" style={{ flex: '1 1 14rem' }}>
        <label className="gts-label" htmlFor="employeeId">
          Employee
        </label>
        <select
          id="employeeId"
          name="employeeId"
          required
          className="gts-input gts-select"
          defaultValue=""
          aria-invalid={errorFor(state, 'employeeId') ? true : undefined}
        >
          <option value="">Select an employee</option>
          {candidates.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.nameEn} — {employee.jobTitleEn}
            </option>
          ))}
        </select>
      </div>

      <div className="gts-field" style={{ flex: '1 1 12rem' }}>
        <label className="gts-label" htmlFor="roleOnSite">
          Role on site
        </label>
        <input
          id="roleOnSite"
          name="roleOnSite"
          className="gts-input"
          placeholder="Site foreman"
        />
      </div>

      <Submit variant="primary" pendingLabel="Assigning…">
        Assign
      </Submit>
    </form>
  );
}

/** Ends an assignment. A button rather than a link: it changes state. */
export function ReleaseButton({
  assignmentId,
  projectId,
  name,
}: {
  assignmentId: string;
  projectId: string;
  name: string;
}) {
  const [state, formAction] = useActionState(submitReleaseEmployee, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        className="gts-btn gts-btn-ghost gts-btn-xs"
        aria-label={`Release ${name} from this project`}
      >
        Release
      </button>
      {state && !state.ok && (
        <p className="gts-help gts-help-error">{state.message}</p>
      )}
    </form>
  );
}
