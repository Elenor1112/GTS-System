import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requireActor } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

import { PasswordForm } from './password-form';

export const metadata: Metadata = { title: 'Your account — GTS' };
export const dynamic = 'force-dynamic';

/**
 * YOUR ACCOUNT.
 *
 * `requireActor`, not `requirePermission`: this is the one page every
 * signed-in person may open, because it is about them. There is no
 * permission that could gate it sensibly — refusing someone access to
 * their own password would leave them unable to change it.
 *
 * Read-only apart from the password. Name, role and employee record are
 * administered from /users by somebody with the permission to do it —
 * self-service editing of your own role would defeat the point of roles.
 */
export default async function AccountPage() {
  const actor = await requireActor();
  const dict = await t();
  const locale = await getLocale();

  const [user, sessionCount] = await Promise.all([
    db.user.findUnique({
      where: { id: actor.id },
      select: {
        email: true, nameEn: true, nameAr: true, lastLoginAt: true, createdAt: true,
        role: { select: { nameEn: true } },
        employee: { select: { code: true, jobTitleEn: true, department: true } },
      },
    }),
    // Sessions that are still live — the honest answer to "where am I
    // signed in", without pretending to identify each device.
    db.session.count({ where: { userId: actor.id, expiresAt: { gt: new Date() } } }),
  ]);

  // requireActor() already proved the row exists; this is for the type.
  if (!user) throw new Error('The signed-in user no longer exists.');

  return (
    <Shell active="/account" domain="admin">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={dict.admin.account.overline}
          title={user.nameEn}
          lede={[user.role.nameEn, user.employee?.jobTitleEn].filter(Boolean).join(' · ')}
        />

        <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <div className="gts-stat-row">
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">{dict.admin.account.email}</p>
              <p className="text-fg mt-2">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">{dict.admin.account.role}</p>
              <p className="text-fg mt-2">{user.role.nameEn}</p>
            </div>
            {user.employee && (
              <div>
                <p className="text-xs text-fg-muted uppercase tracking-wide">{dict.admin.account.employee}</p>
                <p className="text-fg mt-2">{user.employee.code}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">{dict.admin.account.lastSignedIn}</p>
              <p className="text-fg mt-2">
                {user.lastLoginAt ? formatDate(user.lastLoginAt.toISOString(), locale) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">{dict.admin.account.activeSessions}</p>
              <p className="text-fg mt-2">
                <span className="gts-num gts-num-md">{sessionCount}</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-fg-secondary mt-4">
            {dict.admin.account.administeredNote}
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">{dict.admin.account.passwordSectionTitle}</h2>
          <PasswordForm dict={dict.admin.account.passwordForm} />
        </section>
      </main>
    </Shell>
  );
}
