'use client';

import { useActionState, useState } from 'react';

import { FormError, FormActions, FieldGrid, TextField, SelectField, Submit, errorFor } from '@/components/form';

import { submitNewUser, submitUserAction } from './actions';

/**
 * The per-row controls: change role, deactivate, reset password.
 *
 * The role selector submits on change rather than needing a save button
 * — it is one field, and a table row full of save buttons is noise. The
 * server refuses a change that would remove the last administrator, and
 * the message says so rather than failing silently.
 */
export function UserRow({
  userId,
  currentRoleId,
  isActive,
  isSelf,
  name,
  roles,
}: {
  userId: string;
  currentRoleId: string;
  isActive: boolean;
  isSelf: boolean;
  name: string;
  roles: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(submitUserAction, null);
  const [resetting, setResetting] = useState(false);

  if (resetting) {
    return (
      <form action={formAction} className="gts-decision-reason">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="intent" value="reset" />
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoFocus
          className="gts-input gts-input-sm"
          placeholder={`New password for ${name}`}
          aria-label={`New password for ${name}`}
        />
        <Submit variant="primary" pendingLabel="…">
          Set
        </Submit>
        <button
          type="button"
          className="gts-btn gts-btn-ghost gts-btn-sm"
          onClick={() => setResetting(false)}
        >
          Cancel
        </button>
        {state && !state.ok && <p className="gts-help gts-help-error">{state.message}</p>}
      </form>
    );
  }

  return (
    <form action={formAction} className="gts-user-row">
      <input type="hidden" name="userId" value={userId} />

      <select
        name="roleId"
        defaultValue={currentRoleId}
        className="gts-input gts-select gts-input-sm"
        aria-label={`Role for ${name}`}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.label}
          </option>
        ))}
      </select>
      {/* The select's own submit carries this intent. */}
      <input type="hidden" name="intent" value="role" />

      <div className="gts-user-row-actions">
        <button
          type="submit"
          name="intent"
          value="reset"
          className="gts-btn gts-btn-ghost gts-btn-xs"
          onClick={(event) => {
            event.preventDefault();
            setResetting(true);
          }}
        >
          Reset password
        </button>

        {/* You cannot deactivate yourself — the server refuses it too,
            but offering the button would be a trap. */}
        {!isSelf && (
          <button
            type="submit"
            name="intent"
            value={isActive ? 'deactivate' : 'activate'}
            className={`gts-btn gts-btn-xs ${isActive ? 'gts-btn-danger' : 'gts-btn-secondary'}`}
          >
            {isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
      </div>

      {state && !state.ok && <p className="gts-help gts-help-error">{state.message}</p>}
    </form>
  );
}

/** Create a login. */
export function NewUserForm({
  roles,
  employees,
}: {
  roles: { id: string; label: string }[];
  employees: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(submitNewUser, null);
  const e = (field: string) => errorFor(state, field);

  return (
    <form action={formAction} className="gts-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          Created {String(state.data.email)}. They can sign in with the password you set.
        </p>
      )}

      <FieldGrid>
        <TextField
          name="email"
          label="Email address"
          type="email"
          required
          error={e('email')}
          autoComplete="off"
        />
        <TextField name="nameEn" label="Name" required error={e('nameEn')} />
        <TextField name="nameAr" label="Name (Arabic)" error={e('nameAr')} />
        <TextField name="phone" label="Phone" type="tel" error={e('phone')} />

        <SelectField
          name="roleId"
          label="Role"
          required
          placeholder="Select a role"
          error={e('roleId')}
          options={roles.map((r) => ({ value: r.id, label: r.label }))}
        />

        <SelectField
          name="employeeId"
          label="Employee record"
          hint="Required for attendance and leave; leave blank for an office-only login"
          placeholder="No employee record"
          error={e('employeeId')}
          options={employees.map((emp) => ({ value: emp.id, label: emp.label }))}
        />

        <TextField
          name="password"
          label="Password"
          type="password"
          required
          hint="At least 12 characters. Length matters more than symbols."
          error={e('password')}
          autoComplete="new-password"
        />
      </FieldGrid>

      <FormActions>
        <Submit variant="accent" pendingLabel="Creating…">
          Create account
        </Submit>
      </FormActions>
    </form>
  );
}
