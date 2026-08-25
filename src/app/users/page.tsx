import type { Metadata } from 'next';

import { Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can, ADMIN_ROLE } from '@/lib/permissions';
import { listUsers, listRoles } from '@/lib/services/people';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

import { UserRow, NewUserForm } from './user-forms';

export const metadata: Metadata = { title: 'Users — GTS' };
export const dynamic = 'force-dynamic';

/**
 * USERS — who can sign in, and as what.
 *
 * A user is a login; an employee is a person the business employs. They
 * are separate because a financial controller may never check in
 * anywhere, and a site labourer may have no login at all. Linking one to
 * the other is what makes attendance and leave possible for that person.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const actor = await requirePermission('users.view');
  const params = await searchParams;
  const dict = await t();
  const locale = await getLocale();

  const includeInactive = params.inactive === '1';
  const mayManage = can(actor, 'users.manage');

  const [users, roles] = await Promise.all([
    listUsers({ includeInactive }),
    listRoles(),
  ]);

  const admins = users.filter((u) => u.role.key === ADMIN_ROLE && u.isActive).length;

  return (
    <Shell active="/users" domain="admin">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={dict.admin.users.overline}
          title={dict.admin.users.title}
          lede={`${users.length} ${dict.admin.users.ledeAccounts}${users.length === 1 ? '' : 's'} · ${admins} ${dict.admin.users.ledeAdministrators}${
            admins === 1 ? '' : 's'
          }`}
        />

        {admins === 1 && (
          <p className="px-4 py-3 rounded-sm bg-danger-bg border border-danger-br text-danger text-sm" role="status">
            {dict.admin.users.lastAdminWarning}
          </p>
        )}

        <form method="get" className="bg-surface rounded-lg border border-line shadow-raised p-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-fg-secondary h-touch">
            <input type="checkbox" name="inactive" value="1" defaultChecked={includeInactive} className="accent-brand" />
            {dict.admin.users.includeDeactivated}
          </label>
          <button
            type="submit"
            className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors"
          >
            {dict.admin.users.apply}
          </button>
        </form>

        <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
          <h2 className="text-lg font-semibold text-fg px-6 pt-6 pb-4">{dict.admin.users.accountsRegion}</h2>
          {users.length === 0 ? (
            <Empty title={dict.admin.users.emptyTitle} body={dict.admin.users.emptyBody} />
          ) : (
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">{dict.admin.users.tableCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{dict.admin.users.table.user}</th>
                    <th scope="col">{dict.admin.users.table.role}</th>
                    <th scope="col">{dict.admin.users.table.employee}</th>
                    <th scope="col">{dict.admin.users.table.lastSignedIn}</th>
                    <th scope="col">{dict.admin.users.table.status}</th>
                    {mayManage && <th scope="col" />}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <th scope="row">
                        {user.nameEn}
                        <span className="gts-meta gts-cell-sub">{user.email}</span>
                      </th>
                      <td>
                        {mayManage ? (
                          <UserRow
                            userId={user.id}
                            currentRoleId={user.role.id}
                            isActive={user.isActive}
                            isSelf={user.id === actor.id}
                            name={user.nameEn}
                            roles={roles.map((r) => ({ id: r.id, label: r.nameEn }))}
                            dict={dict.admin.users.row}
                          />
                        ) : (
                          user.role.nameEn
                        )}
                      </td>
                      <td>
                        {user.employee ? (
                          <>
                            {user.employee.code}
                            <span className="gts-meta gts-cell-sub">
                              {user.employee.jobTitleEn}
                            </span>
                          </>
                        ) : (
                          // Not a defect: an accounts-only login has no
                          // attendance to record.
                          <span className="gts-meta">{dict.admin.users.noEmployeeRecord}</span>
                        )}
                      </td>
                      <td>
                        {user.lastLoginAt ? (
                          formatDate(user.lastLoginAt.toISOString(), locale)
                        ) : (
                          <span className="gts-meta">{dict.admin.users.never}</span>
                        )}
                        {user._count.sessions > 0 && (
                          <span className="gts-meta gts-cell-sub">
                            {user._count.sessions}{' '}
                            {user._count.sessions === 1
                              ? dict.admin.users.activeSession
                              : dict.admin.users.activeSessions}
                          </span>
                        )}
                      </td>
                      <td>
                        <Status tone={user.isActive ? 'success' : 'neutral'}>
                          {user.isActive ? dict.admin.users.statusActive : dict.admin.users.statusDeactivated}
                        </Status>
                      </td>
                      {mayManage && <td />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {mayManage && (
          <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
            <h2 className="text-lg font-semibold text-fg mb-4">{dict.admin.users.newAccountRegion}</h2>
            <NewUserForm
              roles={roles.map((r) => ({ id: r.id, label: r.nameEn }))}
              dict={dict.admin.users.form}
            />
          </section>
        )}

        {can(actor, 'employees.view') && (
          <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
            <h2 className="text-lg font-semibold text-fg mb-3">{dict.admin.users.employeesRegion}</h2>
            <p className="text-sm text-fg-secondary mb-4">
              {dict.admin.users.employeesBody}
            </p>
            <a
              href="/employees"
              className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg inline-flex items-center hover:bg-hover transition-colors"
            >
              {dict.admin.users.openEmployees}
            </a>
          </section>
        )}
      </main>
    </Shell>
  );
}
