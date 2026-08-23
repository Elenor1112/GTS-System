'use client';

import { useActionState } from 'react';

import { FormError, FieldGrid, TextField, Submit, FormActions, errorFor } from '@/components/form';
import type { Dictionary } from '@/lib/i18n';

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
export function PasswordForm({ dict }: { dict: Dictionary['admin']['account']['passwordForm'] }) {
  const [state, formAction] = useActionState(changePassword, null);

  const e = (field: string) => errorFor(state, field);

  if (state?.ok) {
    return (
      <div className="gts-auth-notice" role="status">
        {dict.successNotice}
      </div>
    );
  }

  return (
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      <FieldGrid>
        <TextField
          name="currentPassword"
          label={dict.currentPasswordLabel}
          type="password"
          required
          autoComplete="current-password"
          error={e('currentPassword')}
        />
      </FieldGrid>

      <FieldGrid>
        <TextField
          name="newPassword"
          label={dict.newPasswordLabel}
          type="password"
          required
          autoComplete="new-password"
          hint={dict.newPasswordHint}
          error={e('newPassword')}
        />
        <TextField
          name="confirmPassword"
          label={dict.confirmPasswordLabel}
          type="password"
          required
          autoComplete="new-password"
          error={e('confirmPassword')}
        />
      </FieldGrid>

      <FormActions>
        <Submit pendingLabel={dict.changingButton}>{dict.changeButton}</Submit>
      </FormActions>
    </form>
  );
}
