'use client';

import { useState, type ReactNode } from 'react';

import { Icon } from './icon';

/**
 * A collapsible category in the desktop rail (Accounting, Warehouses,
 * Human Resources, System). Starts open when it contains the active
 * route so the current page is never hidden behind a closed dropdown;
 * otherwise starts closed to keep the rail scannable as more groups
 * are added. Purely client-side UI state — no permission logic here,
 * that already happened server-side in Shell before items reach us.
 */
export function NavGroup({
  label,
  icon,
  defaultOpen,
  children,
}: {
  label: string;
  icon: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-medium text-fg-secondary hover:bg-hover transition-colors"
      >
        <Icon name={icon} />
        <span className="flex-1 text-start">{label}</span>
        <Icon
          name="expand_more"
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="flex flex-col gap-1 ps-4">{children}</div>}
    </div>
  );
}
