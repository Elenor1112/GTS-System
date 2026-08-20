import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getActor } from '@/lib/auth';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in — GTS',
};

/**
 * Sign in.
 *
 * The one route outside the app shell: no rail, no navigation, nothing to
 * click but the form. A signed-in visitor is sent straight on rather than
 * being shown a form they do not need.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; reason?: string }>;
}) {
  const actor = await getActor();
  const params = await searchParams;

  if (actor) {
    redirect(params.from && params.from.startsWith('/') ? params.from : '/dashboard');
  }

  return (
    <main className="gts-auth">
      <div className="gts-auth-panel">
        <div className="gts-auth-brand">
          <span className="gts-auth-mark">
            GTS<span style={{ color: 'var(--gts-accent)' }}>.</span>
          </span>
          <p className="gts-overline" style={{ marginBlockStart: 'var(--gts-space-3)' }}>
            Business operating system
          </p>
        </div>

        <h1 className="gts-auth-title">Sign in</h1>

        {params.reason === 'expired' && (
          <div className="gts-auth-notice" role="status">
            Your session ended. Sign in again to continue.
          </div>
        )}
        {params.reason === 'forbidden' && (
          <div className="gts-auth-notice" role="status">
            You do not have permission to open that page.
          </div>
        )}

        <SignInForm redirectTo={params.from} />
      </div>

      {/* The seeded development credentials. Rendered only outside
          production so a deployed instance never advertises them. */}
      {process.env.NODE_ENV !== 'production' && (
        <p className="gts-auth-hint">
          Development sign-in — <code>admin@gts.example</code> / <code>Admin!2026</code>
        </p>
      )}
    </main>
  );
}
