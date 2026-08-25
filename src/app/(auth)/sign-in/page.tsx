import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { getActor } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { Icon } from '@/components/icon';
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

  const dict = await t();
  const a = dict.auth;

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center gap-8 p-6 overflow-hidden bg-page">
      {/* Atmospheric background elements, matching the Stitch mockup. */}
      <div
        className="absolute -top-[10%] -start-[10%] w-[50vw] h-[50vw] rounded-full bg-brand-bg/40 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-[10%] -end-[10%] w-[40vw] h-[40vw] rounded-full bg-secondary-container/30 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[440px] bg-surface rounded-lg border border-line p-8 shadow-raised flex flex-col gap-8">
        <div className="flex flex-col items-center text-center gap-3">
          <Image
            src="/logo-mark.png"
            alt="GTS"
            width={1244}
            height={361}
            priority
            className="h-14 w-auto"
          />
          <p className="text-lg text-fg-secondary m-0">{a.tagline}</p>
        </div>

        {params.reason === 'expired' && (
          <div className="px-4 py-3 rounded-sm bg-info-bg border border-info-br text-info text-sm" role="status">
            {a.sessionExpired}
          </div>
        )}
        {params.reason === 'forbidden' && (
          <div className="px-4 py-3 rounded-sm bg-info-bg border border-info-br text-info text-sm" role="status">
            {a.forbidden}
          </div>
        )}

        <SignInForm redirectTo={params.from} dict={a} />
      </div>

      {/* The seeded development credentials. Rendered only outside
          production so a deployed instance never advertises them. */}
      {process.env.NODE_ENV !== 'production' && (
        <aside className="relative z-10 w-full max-w-[440px] bg-inset border border-line rounded-sm p-4 flex items-start gap-4">
          <Icon name="info" className="text-brand-fg mt-0.5" />
          <div>
            <h2 className="text-sm font-medium text-fg mb-1">{a.devHint}</h2>
            <p className="text-fg-secondary bg-hover px-2 py-1 rounded-xs inline-block font-mono text-xs border border-line">
              <code>admin@gts.example</code> / <code>Admin!2026</code>
            </p>
          </div>
        </aside>
      )}
    </main>
  );
}
