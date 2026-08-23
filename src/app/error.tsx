'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * GTS — the application error boundary.
 *
 * The guards in `lib/auth.ts` throw rather than returning a flag, so that
 * forgetting to check a return value cannot leave an action running
 * unauthorised. That is the right shape, but it only works if something
 * catches the throw. Without this file every expired session rendered a
 * raw Next error overlay and a 500.
 *
 * Classification is by `digest`, not by `instanceof` or `message`. This
 * is a client component: Next strips a server error's message and stack
 * before it arrives here, and minification renames the classes. The
 * digest is the only thing that survives, and `lib/auth.ts` sets it
 * deliberately for exactly this reason.
 */

// Kept in sync with AUTH_DIGEST in lib/auth.ts. Not imported from there:
// that module is `server-only`, and importing it into a client component
// would fail the build.
const UNAUTHENTICATED = 'GTS_UNAUTHENTICATED';
const FORBIDDEN = 'GTS_FORBIDDEN';

// Same reason `lib/preferences.ts` isn't imported here: it is
// `server-only`. The cookie name is duplicated rather than shared.
function isArabic(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c === 'gts_locale=ar');
}

const STRINGS = {
  en: {
    redirecting: 'Your session ended. Taking you to sign in…',
    notPermittedTitle: 'Not permitted',
    notPermittedBody:
      'You do not have permission to open that page. If you believe you should, ask your administrator to review your role.',
    backToDashboard: 'Back to dashboard',
    somethingWrong: 'Something went wrong',
    faultBody:
      'The page could not be displayed. Try again, and if it keeps happening quote the reference below.',
    reference: 'Reference:',
    tryAgain: 'Try again',
  },
  ar: {
    redirecting: 'انتهت جلستك. جارٍ نقلك إلى صفحة تسجيل الدخول…',
    notPermittedTitle: 'غير مسموح',
    notPermittedBody: 'ليست لديك صلاحية لفتح هذه الصفحة. إذا كنت تعتقد أن لديك صلاحية، اطلب من مسؤول النظام مراجعة دورك.',
    backToDashboard: 'العودة إلى لوحة التحكم',
    somethingWrong: 'حدث خطأ ما',
    faultBody: 'تعذر عرض الصفحة. حاول مرة أخرى، وإذا استمرت المشكلة اذكر الرقم المرجعي أدناه.',
    reference: 'الرقم المرجعي:',
    tryAgain: 'حاول مرة أخرى',
  },
} as const;

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const digest = error.digest;
  const s = STRINGS[isArabic() ? 'ar' : 'en'];

  useEffect(() => {
    if (digest === UNAUTHENTICATED) {
      /*
       * Send them to sign in, remembering where they were.
       *
       * `replace`, not `push`: the page they could not see must not sit
       * in history for the back button to return to.
       *
       * Deliberately NO `router.refresh()` here. Refreshing re-fetches
       * the route that just threw, which throws again and re-mounts this
       * boundary, which refreshes again — the redirect never lands and
       * the server logs an endless 500/200 pair per cycle. Nothing needs
       * the refresh anyway: signing in sets a new cookie, and the
       * navigation back to the protected route is a fresh request that
       * renders against that new session.
       */
      const from = window.location.pathname + window.location.search;
      router.replace(`/sign-in?from=${encodeURIComponent(from)}&reason=expired`);
    }
  }, [digest, router]);

  if (digest === UNAUTHENTICATED) {
    // The redirect is in flight. Announce it rather than flashing an
    // error the user is about to be navigated away from.
    return (
      <main className="gts-auth">
        <div className="gts-auth-panel">
          <p role="status">{s.redirecting}</p>
        </div>
      </main>
    );
  }

  if (digest === FORBIDDEN) {
    return (
      <main className="gts-auth">
        <div className="gts-auth-panel">
          <h1 className="gts-auth-title">{s.notPermittedTitle}</h1>
          <p className="gts-auth-notice" role="alert">
            {s.notPermittedBody}
          </p>
          <a className="gts-btn gts-btn-primary gts-btn-block" href="/dashboard">
            {s.backToDashboard}
          </a>
        </div>
      </main>
    );
  }

  /*
   * Anything else is a genuine fault.
   *
   * The message is deliberately not rendered: an unexpected error's text
   * may carry a query, a column name or a connection string, none of
   * which belong on a user's screen. `lib/action.ts` takes the same line
   * for the same reason. The digest is shown because it is the handle
   * that ties this screen to the server log.
   */
  return (
    <main className="gts-auth">
      <div className="gts-auth-panel">
        <h1 className="gts-auth-title">{s.somethingWrong}</h1>
        <p className="gts-auth-notice" role="alert">
          {s.faultBody}
        </p>
        {digest && (
          <p className="gts-help">
            {s.reference} <code>{digest}</code>
          </p>
        )}
        <button type="button" className="gts-btn gts-btn-primary gts-btn-block" onClick={reset}>
          {s.tryAgain}
        </button>
      </div>
    </main>
  );
}
