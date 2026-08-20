import type { Metadata } from 'next';
import { Fragment } from 'react';

import { Region, Status } from '@/components/primitives';
import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can, PERMISSIONS_BY_MODULE, ADMIN_ROLE } from '@/lib/permissions';
import { listRoles } from '@/lib/services/people';

import { RolePermissionsForm } from './permission-forms';

export const metadata: Metadata = { title: 'Permissions — GTS' };
export const dynamic = 'force-dynamic';

/**
 * PERMISSIONS — the access matrix.
 *
 * This screen shows what each role may do. It is a view of the SAME
 * permission keys the server checks in `requirePermission()`, read from
 * the same table — not a parallel description of the rules that could
 * drift from them.
 *
 * The administrator row is rendered full and locked. That role holds
 * every permission implicitly through `can()`, so presenting editable
 * checkboxes would offer a change the system would silently ignore.
 */
export default async function PermissionsPage() {
  const actor = await requirePermission('roles.manage');
  const roles = await listRoles();

  const modules = Object.entries(PERMISSIONS_BY_MODULE).sort(([a], [b]) => a.localeCompare(b));
  const mayEdit = can(actor, 'roles.manage');

  return (
    <Shell active="/permissions" domain="admin">
      <main className="gts-page">
        <PageHead
          overline="System"
          title="Permissions"
          lede={`${roles.length} roles across ${modules.length} modules. Every one of these keys is checked on the server before the action runs — hiding a button is a courtesy, not a control.`}
        />

        {/* ---------- The matrix ---------- */}
        <Region title="Access matrix">
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-compact">
              <caption className="gts-sr">
                Which permissions each role holds, by module
              </caption>
              <thead>
                <tr>
                  <th scope="col">Permission</th>
                  {roles.map((role) => (
                    <th key={role.id} scope="col" className="gts-matrix-head">
                      {role.nameEn}
                      <span className="gts-meta gts-cell-sub">
                        {role.holdsAllImplicitly ? 'all' : `${role.permissionKeys.length}`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map(([module, permissions]) => (
                  <Fragment key={module}>
                    <tr className="gts-matrix-module">
                      <th scope="rowgroup" colSpan={roles.length + 1}>
                        {module}
                      </th>
                    </tr>
                    {permissions.map((permission) => (
                      <tr key={permission.key}>
                        <th scope="row">
                          {permission.description}
                          <span className="gts-meta gts-cell-sub">
                            <bdi>{permission.key}</bdi>
                          </span>
                        </th>
                        {roles.map((role) => {
                          const held = role.permissionKeys.includes(permission.key);
                          return (
                            <td key={role.id} className="gts-matrix-cell">
                              {held ? (
                                <span
                                  className="gts-matrix-yes"
                                  aria-label={`${role.nameEn} may ${permission.description.toLowerCase()}`}
                                >
                                  ●
                                </span>
                              ) : (
                                <span className="gts-matrix-no" aria-label="not held">
                                  ·
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Region>

        {/* ---------- Editing, role by role ---------- */}
        {mayEdit &&
          roles.map((role) => (
            <Region key={role.id} title={role.nameEn}>
              <p className="gts-meta" style={{ marginBlockEnd: 'var(--gts-space-4)' }}>
                {role.description}
                {' · '}
                {role._count.users} user{role._count.users === 1 ? '' : 's'}
                {role.isSystem && (
                  <>
                    {' · '}
                    <Status tone="info">system role</Status>
                  </>
                )}
              </p>

              {role.key === ADMIN_ROLE ? (
                <p className="gts-form-error" role="status">
                  The administrator role holds every permission implicitly, so there is nothing
                  to tick or untick — a reduced set here would appear to save and change nothing.
                  Create a separate role if somebody needs narrower access.
                </p>
              ) : (
                <RolePermissionsForm
                  roleId={role.id}
                  roleName={role.nameEn}
                  held={role.permissionKeys}
                  modules={modules.map(([module, permissions]) => ({
                    module,
                    permissions: permissions.map((p) => ({
                      key: p.key,
                      description: p.description,
                    })),
                  }))}
                />
              )}
            </Region>
          ))}
      </main>
    </Shell>
  );
}
