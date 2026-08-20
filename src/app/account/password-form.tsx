'use client';

import { useActionState } from 'react';

import { FormError, FieldGrid, TextField, Submit, FormActions, errorFor } from '@/components/form';

import { changePassword } from '../(auth)/actions';

/**
 * Change your own password.
 *
 * On success every OTHER session is destroyed and this one is reissued —
 * `changePassword` does that, because a password change is what someone
 * does when they think a session may be compromised. The confirmation
 * says so, since being signed out on your other devices is surprising if
 * it happens silently.
 */
export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, null);

  const e = (field: string) => errorFor(state, field);

  if (state?.ok) {
    return (
      <div className="gts-auth-notice" role="status">
        Your password has been changed. Any other device you were signed in on has been signed out.
      </div>
    );
  }

  return (
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      <FieldGrid>
        <TextField
          name="currentPassword"
          label="Current password"
          type="password"
          required
          autoComplete="current-password"
          error={e('currentPassword')}
        />
      </FieldGrid>

      <FieldGrid>
        <TextField
          name="newPassword"
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 12 characters. Length is what resists cracking — a passphrase beats a short password with symbols in it."
          error={e('newPassword')}
        />
        <TextField
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          required
          autoComplete="new-password"
          error={e('confirmPassword')}
        />
      </FieldGrid>

      <FormActions>
        <Submit pendingLabel="Changing…">Change password</Submit>
      </FormActions>
    </form>
  );
}
