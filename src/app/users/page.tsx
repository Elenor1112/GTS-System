import type { Metadata } from 'next';

import { Region, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can, ADMIN_ROLE } from '@/lib/permissions';
import { listUsers, listRoles, listEmployees } from '@/lib/services/people';
import { formatDate } from '@/lib/format';

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

  const includeInactive = params.inactive === '1';
  const mayManage = can(actor, 'users.manage');

  const [users, roles, employees] = await Promise.all([
    listUsers({ includeInactive }),
    listRoles(),
    mayManage ? listEmployees() : [],
  ]);

  const admins = users.filter((u) => u.role.key === ADMIN_ROLE && u.isActive).length;
  /** Employees with no login yet — the candidates for a new account. */
  const unlinked = employees.filter((e) => !e.user);

  return (
    <Shell active="/users" domain="admin">
      <main className="gts-page">
        <PageHead
          overline="System"
          title="Users"
          lede={`${users.length} account${users.length === 1 ? '' : 's'} · ${admins} administrator${
            admins === 1 ? '' : 's'
          }`}
        />

        {admins === 1 && (
          <p className="gts-form-error" role="status">
            There is only one administrator. If that account is lost, nobody can administer the
            system — the last administrator cannot be demoted or deactivated for exactly that
            reason. Consider promoting a second.
          </p>
        )}

        <form method="get" className="gts-filter-bar">
          <label className="gts-check">
            <input type="checkbox" name="inactive" value="1" defaultChecked={includeInactive} />
            Include deactivated
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            Apply
          </button>
        </form>

        <Region title="Accounts">
          {users.length === 0 ? (
            <Empty title="No users" body="Nobody can sign in yet." />
          ) : (
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">User accounts, their roles and employee links</caption>
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Role</th>
                    <th scope="col">Employee</th>
                    <th scope="col">Last signed in</th>
                    <th scope="col">Status</th>
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
                          <span className="gts-meta">no employee record</span>
                        )}
                      </td>
                      <td>
                        {user.lastLoginAt ? (
                          formatDate(user.lastLoginAt.toISOString())
                        ) : (
                          <span className="gts-meta">never</span>
                        )}
                        {user._count.sessions > 0 && (
                          <span className="gts-meta gts-cell-sub">
                            {user._count.sessions} active session
                            {user._count.sessions === 1 ? '' : 's'}
                          </span>
                        )}
                      </td>
                      <td>
                        <Status tone={user.isActive ? 'success' : 'neutral'}>
                          {user.isActive ? 'active' : 'deactivated'}
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
          <Region title="New account">
            <NewUserForm
              roles={roles.map((r) => ({ id: r.id, label: r.nameEn }))}
              employees={unlinked.map((e) => ({
                id: e.id,
                label: `${e.nameEn} — ${e.code}, ${e.jobTitleEn}`,
              }))}
            />
          </Region>
        )}

        {can(actor, 'employees.view') && (
          <Region title={`Employees (${employees.length})`}>
            {employees.length === 0 ? (
              <Empty
                title="No employees"
                body="An employee is a person the business employs, whether or not they have a login."
              />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">Employee</th>
                      <th scope="col">Job title</th>
                      <th scope="col">Department</th>
                      <th scope="col">Hired</th>
                      <th scope="col">Login</th>
                      <th scope="col" className="gts-cell-num">Sites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <th scope="row">
                          {employee.nameEn}
                          <span className="gts-meta gts-cell-sub">{employee.code}</span>
                        </th>
                        <td>{employee.jobTitleEn}</td>
                        <td>{employee.department ?? <span className="gts-meta">—</span>}</td>
                        <td>{formatDate(employee.hiredOn.toISOString())}</td>
                        <td>
                          {employee.user ? (
                            employee.user.email
                          ) : (
                            <span className="gts-meta">none</span>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          <span className="gts-num gts-num-sm">{employee._count.projects}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Region>
        )}
      </main>
    </Shell>
  );
}
