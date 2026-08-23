'use client';

import { useActionState, useState } from 'react';

import { FormError, FormActions, FieldGrid, TextField, SelectField, Submit, errorFor } from '@/components/form';
import type { Dictionary } from '@/lib/i18n';

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
  dict,
}: {
  userId: string;
  currentRoleId: string;
  isActive: boolean;
  isSelf: boolean;
  name: string;
  roles: { id: string; label: string }[];
  dict: Dictionary['admin']['users']['row'];
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
          placeholder={`${dict.newPasswordPlaceholder} ${name}`}
          aria-label={`${dict.newPasswordPlaceholder} ${name}`}
        />
        <Submit variant="primary" pendingLabel="…">
          {dict.set}
        </Submit>
        <button
          type="button"
          className="gts-btn gts-btn-ghost gts-btn-sm"
          onClick={() => setResetting(false)}
        >
          {dict.cancel}
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
        aria-label={`${dict.roleLabel} ${name}`}
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
          {dict.resetPassword}
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
            {isActive ? dict.deactivate : dict.reactivate}
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
  dict,
}: {
  roles: { id: string; label: string }[];
  dict: Dictionary['admin']['users']['form'];
}) {
  const [state, formAction] = useActionState(submitNewUser, null);
  const e = (field: string) => errorFor(state, field);

  return (
    <form action={formAction} className="gts-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          {dict.createdNotice}
        </p>
      )}

      <FieldGrid>
        <TextField name="nameEn" label={dict.nameLabel} required error={e('nameEn')} />
        <TextField
          name="email"
          label={dict.emailLabel}
          type="email"
          required
          error={e('email')}
          autoComplete="off"
        />
        <TextField name="nameAr" label={dict.nameArLabel} required error={e('nameAr')} />
        <TextField name="phone" label={dict.phoneLabel} type="tel" required error={e('phone')} />

        <SelectField
          name="roleId"
          label={dict.roleLabel}
          required
          placeholder={dict.rolePlaceholder}
          error={e('roleId')}
          options={roles.map((r) => ({ value: r.id, label: r.label }))}
        />

        <TextField
          name="password"
          label={dict.passwordLabel}
          type="password"
          required
          hint={dict.passwordHint}
          error={e('password')}
          autoComplete="new-password"
        />
      </FieldGrid>

      <FormActions>
        <Submit variant="accent" pendingLabel={dict.creatingButton}>
          {dict.createButton}
        </Submit>
      </FormActions>
    </form>
  );
}
