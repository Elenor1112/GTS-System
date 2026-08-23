import type { ReactNode } from 'react';

/**
 * Icon set. Geometric marks rather than an icon font — they stay
 * legible at 14px and carry no third-party dependency.
 *
 * Its own leaf module, with no server-only imports: both the server
 * `Shell` and the client `MobileMore` render these marks, and either
 * one importing the other's module would drag `server-only` code
 * (auth, notifications) into the client bundle.
 */
export function Glyph({ name }: { name: string }) {
  const p: Record<string, ReactNode> = {
    accounts: <><path d="M2 5h12v7H2z" /><path d="M2 8h12" /></>,
    bills: <><path d="M4 2h8v12l-2-1.2L8 14l-2-1.2L4 14z" /><path d="M6 6h4M6 9h4" /></>,
    clients: <><circle cx="8" cy="6" r="2.4" /><path d="M3.5 13a4.5 4.5 0 0 1 9 0" /></>,
    vendors: <><path d="M2.5 6.5h11v6h-11z" /><path d="M5 6.5V4h6v2.5" /></>,
    projects: <><path d="M2.5 4.5h5l1 1.5h5v7h-11z" /></>,
    storage: <><path d="M2.5 6 8 3l5.5 3v7h-11z" /><path d="M6.5 13V9h3v4" /></>,
    products: <><path d="M8 2.5 13.5 5.5v5L8 13.5 2.5 10.5v-5z" /><path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" /></>,
    employees: <><circle cx="5.5" cy="5.5" r="2.2" /><path d="M1.8 13a3.7 3.7 0 0 1 7.4 0" /><circle cx="11.5" cy="6.2" r="1.7" /><path d="M9.8 13a3 3 0 0 1 4.4-2.6" /></>,
    attendance: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2.2 1.3" /></>,
    leave: <><path d="M2.5 4.5h11v9h-11z" /><path d="M2.5 7h11M5.5 3v3M10.5 3v3" /></>,
    reports: <><path d="M3 13V7M6.5 13V4M10 13V9M13.5 13V6" /></>,
    users: <><circle cx="6" cy="6" r="2.2" /><path d="M2 13a4 4 0 0 1 8 0" /><path d="M11 5.2a2.2 2.2 0 0 1 0 4.4" /></>,
    permissions: <><path d="M8 2.5 13 4.6v3.6c0 3-2.1 4.8-5 5.8-2.9-1-5-2.8-5-5.8V4.6z" /><path d="M6 8l1.6 1.6L10.4 6.8" /></>,
    audit: <><path d="M3.5 2.5h6l3 3v8h-9z" /><path d="M9.5 2.5v3h3M5.5 8h5M5.5 10.5h3" /></>,
    admin: <><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4" /></>,
    dashboard: <><path d="M2.5 2.5h5v5h-5zM8.5 2.5h5v3h-5zM8.5 6.5h5v7h-5zM2.5 8.5h5v5h-5z" /></>,
    bell: <><path d="M8 2a3.6 3.6 0 0 0-3.6 3.6c0 3.2-1.2 4.2-1.2 4.2h9.6s-1.2-1-1.2-4.2A3.6 3.6 0 0 0 8 2z" /><path d="M6.7 12a1.5 1.5 0 0 0 2.6 0" /></>,
    more: <><circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" /></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      className="gts-icon-fixed" aria-hidden="true" style={{ flex: 'none' }}>
      {p[name] ?? p.dashboard}
    </svg>
  );
}
