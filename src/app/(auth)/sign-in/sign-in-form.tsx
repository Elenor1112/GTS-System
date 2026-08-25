'use client';

import { useActionState } from 'react';

import { signIn } from '../actions';
import type { Dictionary } from '@/lib/i18n';
import { Icon } from '@/components/icon';

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
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* Where to land after signing in. Carried through the form so the
          server does the redirecting; it is re-validated there, since
          anything reaching the server from a form is user input. */}
      <input type="hidden" name="returnTo" value={redirectTo ?? '/dashboard'} />

      {formError && (
        // `data-testid` because Next renders its own empty
        // role="alert" route announcer, which an alert-role query would
        // match ahead of this one.
        <div
          className="px-4 py-3 rounded-sm bg-danger-bg border border-danger-br text-danger text-sm"
          role="alert"
          data-testid="sign-in-error"
        >
          {formError}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-fg" htmlFor="email">
          {dict.emailLabel}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none text-fg-muted">
            <Icon name="person" />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            className="w-full h-touch ps-12 pe-4 rounded-sm border border-line bg-surface text-fg placeholder:text-fg-muted focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors"
            aria-invalid={fieldError('email') ? true : undefined}
            aria-describedby={fieldError('email') ? 'email-error' : undefined}
          />
        </div>
        {fieldError('email') && (
          <p className="text-xs text-danger" id="email-error">
            {fieldError('email')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-fg" htmlFor="password">
          {dict.passwordLabel}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none text-fg-muted">
            <Icon name="lock" />
          </span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full h-touch ps-12 pe-4 rounded-sm border border-line bg-surface text-fg placeholder:text-fg-muted focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors"
            aria-invalid={fieldError('password') ? true : undefined}
            aria-describedby={fieldError('password') ? 'password-error' : undefined}
          />
        </div>
        {fieldError('password') && (
          <p className="text-xs text-danger" id="password-error">
            {fieldError('password')}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="mt-2 w-full h-touch bg-brand text-fg-on-accent font-medium rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
        disabled={pending}
      >
        <Icon name="login" filled />
        {pending ? dict.signingIn : dict.signIn}
      </button>
    </form>
  );
}
