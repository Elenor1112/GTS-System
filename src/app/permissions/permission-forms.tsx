'use client';

import { useActionState, useState } from 'react';

import { FormError, FormActions, Submit } from '@/components/form';
import type { Dictionary } from '@/lib/i18n';

import { submitRolePermissions } from './actions';

/**
 * Edit one role's permissions.
 *
 * Checkboxes post their keys; the server replaces the whole set rather
 * than applying a diff, so a permission removed here is removed there —
 * no partial state where the screen and the database disagree.
 *
 * The module-level "all" toggle is a convenience only. The server
 * validates every key against the permission catalogue and rejects
 * anything it does not recognise.
 */
export function RolePermissionsForm({
  roleId,
  roleName,
  held,
  modules,
  dict,
}: {
  roleId: string;
  roleName: string;
  held: string[];
  modules: { module: string; permissions: { key: string; description: string }[] }[];
  dict: Dictionary['admin']['permissions']['form'];
}) {
  const [state, formAction] = useActionState(submitRolePermissions, null);
  const [checked, setChecked] = useState<Set<string>>(new Set(held));

  const toggle = (key: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleModule = (keys: string[], on: boolean) =>
    setChecked((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  return (
    <form action={formAction}>
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          {dict.savedNotice.replace('{count}', String(state.data.count))}
        </p>
      )}

      <input type="hidden" name="roleId" value={roleId} />
      {/* The chosen keys, one hidden input each: a checkbox that is not
          ticked posts nothing, and the server needs the complete set. */}
      {[...checked].map((key) => (
        <input key={key} type="hidden" name="permissionKeys" value={key} />
      ))}

      <div className="gts-permission-grid">
        {modules.map(({ module, permissions }) => {
          const keys = permissions.map((p) => p.key);
          const allOn = keys.every((k) => checked.has(k));

          return (
            <fieldset key={module} className="gts-permission-module">
              <legend className="gts-overline">{module}</legend>

              <button
                type="button"
                className="gts-btn gts-btn-ghost gts-btn-xs"
                onClick={() => toggleModule(keys, !allOn)}
              >
                {allOn ? dict.clearAll : dict.selectAll}
              </button>

              {permissions.map((permission) => (
                <label key={permission.key} className="gts-check">
                  <input
                    type="checkbox"
                    checked={checked.has(permission.key)}
                    onChange={() => toggle(permission.key)}
                  />
                  <span>
                    {permission.description}
                    <span className="gts-meta gts-cell-sub">
                      <bdi>{permission.key}</bdi>
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>

      <FormActions>
        <Submit variant="accent" pendingLabel={dict.savingButton}>
          {dict.saveButton} {roleName}
        </Submit>
        <span className="gts-meta" style={{ alignSelf: 'center' }}>
          {checked.size} {dict.selected}
        </span>
      </FormActions>
    </form>
  );
}
