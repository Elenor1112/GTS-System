import type { Metadata } from 'next';

import { Region, Status } from '@/components/primitives';
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
      <main className="gts-page">
        <PageHead
          overline={dict.admin.users.overline}
          title={dict.admin.users.title}
          lede={`${users.length} ${dict.admin.users.ledeAccounts}${users.length === 1 ? '' : 's'} · ${admins} ${dict.admin.users.ledeAdministrators}${
            admins === 1 ? '' : 's'
          }`}
        />

        {admins === 1 && (
          <p className="gts-form-error" role="status">
            {dict.admin.users.lastAdminWarning}
          </p>
        )}

        <form method="get" className="gts-filter-bar">
          <label className="gts-check">
            <input type="checkbox" name="inactive" value="1" defaultChecked={includeInactive} />
            {dict.admin.users.includeDeactivated}
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            {dict.admin.users.apply}
          </button>
        </form>

        <Region title={dict.admin.users.accountsRegion}>
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
        </Region>

        {mayManage && (
          <Region title={dict.admin.users.newAccountRegion}>
            <NewUserForm
              roles={roles.map((r) => ({ id: r.id, label: r.nameEn }))}
              dict={dict.admin.users.form}
            />
          </Region>
        )}

        {can(actor, 'employees.view') && (
          <Region title={dict.admin.users.employeesRegion}>
            <p className="gts-body">
              {dict.admin.users.employeesBody}
            </p>
            <a href="/employees" className="gts-btn gts-btn-secondary">
              {dict.admin.users.openEmployees}
            </a>
          </Region>
        )}
      </main>
    </Shell>
  );
}
