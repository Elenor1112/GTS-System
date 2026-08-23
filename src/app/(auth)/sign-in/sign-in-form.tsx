'use client';

import { useActionState } from 'react';

import { signIn } from '../actions';
import type { Dictionary } from '@/lib/i18n';

/**
 * The sign-in form.
 *
 * A real <form action={…}> with useActionState, so it submits and shows
 * errors without JavaScript and simply gets nicer with it.
 *
 * Success is NOT handled here. The action redirects from the server, so
 * the browser commits the session cookie and follows the redirect in one
 * step; a client-side `router.replace()` used to race the cookie write
 * and land on the dashboard with no session attached. Only the failure
 * path returns a result, which is what `state` now carries.
 */
export function SignInForm({
  redirectTo,
  dict,
}: {
  redirectTo?: string;
  dict: Dictionary['auth'];
}) {
  const [state, formAction, pending] = useActionState(signIn, null);

  const fieldError = (field: string) =>
    !state?.ok && state?.fieldErrors?.[field] ? state.fieldErrors[field][0] : undefined;

  const formError =
    state && !state.ok && !state.fieldErrors ? state.message : undefined;

  return (
    <form action={formAction} className="gts-auth-form" noValidate>
      {/* Where to land after signing in. Carried through the form so the
          server does the redirecting; it is re-validated there, since
          anything reaching the server from a form is user input. */}
      <input type="hidden" name="returnTo" value={redirectTo ?? '/dashboard'} />

      {formError && (
        // `data-testid` because Next renders its own empty
        // role="alert" route announcer, which an alert-role query would
        // match ahead of this one.
        <div className="gts-auth-error" role="alert" data-testid="sign-in-error">
          {formError}
        </div>
      )}

      <div className="gts-field">
        <label className="gts-label" htmlFor="email">
          {dict.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="gts-input"
          aria-invalid={fieldError('email') ? true : undefined}
          aria-describedby={fieldError('email') ? 'email-error' : undefined}
        />
        {fieldError('email') && (
          <p className="gts-help gts-help-error" id="email-error">
            {fieldError('email')}
          </p>
        )}
      </div>

      <div className="gts-field">
        <label className="gts-label" htmlFor="password">
          {dict.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="gts-input"
          aria-invalid={fieldError('password') ? true : undefined}
          aria-describedby={fieldError('password') ? 'password-error' : undefined}
        />
        {fieldError('password') && (
          <p className="gts-help gts-help-error" id="password-error">
            {fieldError('password')}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="gts-btn gts-btn-primary gts-btn-lg gts-btn-block"
        disabled={pending}
      >
        {pending ? dict.signingIn : dict.signIn}
      </button>
    </form>
  );
}
