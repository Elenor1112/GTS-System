import type { Metadata } from 'next';
import { Fragment } from 'react';

import { Region, Status } from '@/components/primitives';
import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can, PERMISSIONS_BY_MODULE, ADMIN_ROLE } from '@/lib/permissions';
import { listRoles } from '@/lib/services/people';
import { t } from '@/lib/i18n';

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
  const dict = await t();

  const modules = Object.entries(PERMISSIONS_BY_MODULE).sort(([a], [b]) => a.localeCompare(b));
  const mayEdit = can(actor, 'roles.manage');

  return (
    <Shell active="/permissions" domain="admin">
      <main className="gts-page">
        <PageHead
          overline={dict.admin.permissions.overline}
          title={dict.admin.permissions.title}
          lede={`${roles.length} ${dict.admin.permissions.lede.replace('{modules}', String(modules.length))}`}
        />

        {/* ---------- The matrix ---------- */}
        <Region title={dict.admin.permissions.matrix.title}>
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-compact">
              <caption className="gts-sr">
                {dict.admin.permissions.matrix.caption}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{dict.admin.permissions.matrix.permissionHeader}</th>
                  {roles.map((role) => (
                    <th key={role.id} scope="col" className="gts-matrix-head">
                      {role.nameEn}
                      <span className="gts-meta gts-cell-sub">
                        {role.holdsAllImplicitly ? dict.admin.permissions.matrix.allBadge : `${role.permissionKeys.length}`}
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
                                  aria-label={`${role.nameEn} ${dict.admin.permissions.matrix.mayLabel} ${permission.description.toLowerCase()}`}
                                >
                                  ●
                                </span>
                              ) : (
                                <span className="gts-matrix-no" aria-label={dict.admin.permissions.matrix.notHeld}>
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
                {role._count.users} {role._count.users === 1 ? dict.admin.permissions.userCount : dict.admin.permissions.userCountPlural}
                {role.isSystem && (
                  <>
                    {' · '}
                    <Status tone="info">{dict.admin.permissions.systemRoleBadge}</Status>
                  </>
                )}
              </p>

              {role.key === ADMIN_ROLE ? (
                <p className="gts-form-error" role="status">
                  {dict.admin.permissions.adminLocked}
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
                  dict={dict.admin.permissions.form}
                />
              )}
            </Region>
          ))}
      </main>
    </Shell>
  );
}
