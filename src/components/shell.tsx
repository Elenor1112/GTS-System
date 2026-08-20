import type { ReactNode } from 'react';

import { getActor, type Actor } from '@/lib/auth';
import { can, type PermissionKey } from '@/lib/permissions';
import { unreadCount } from '@/lib/services/notifications';
import { UserMenu } from './user-menu';

/* ============================================================
   APP SHELL — rail + workspace.

   The rail is dark against a light workspace: the system's
   signature structural move. Its active marker takes the
   DOMAIN colour, so the rail tells you which world you are in
   before you read a word.

   Navigation is PERMISSION-AWARE: a storekeeper does not see
   an Accounts link they would only be refused at. That is a
   courtesy, not a control — every one of these routes checks
   its own permission server-side regardless of what the rail
   chose to render.

   Mobile is a different architecture, not a shrunk rail —
   five destinations plus overflow, with Attendance centre
   because it is the daily action.
   ============================================================ */

export type Domain =
  | 'finance' | 'inventory' | 'projects' | 'clients'
  | 'vendors' | 'attendance' | 'admin';

type NavItem = { label: string; href: string; domain: Domain; permission: PermissionKey };
type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: 'Financial',
    items: [
      { label: 'Accounts', href: '/accounts', domain: 'finance', permission: 'accounts.view' },
      { label: 'Electronic bills', href: '/bills', domain: 'finance', permission: 'bills.view' },
      { label: 'Clients', href: '/clients', domain: 'clients', permission: 'clients.view' },
      { label: 'Vendors', href: '/vendors', domain: 'vendors', permission: 'vendors.view' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Projects', href: '/projects', domain: 'projects', permission: 'projects.view' },
      { label: 'Storage', href: '/storage', domain: 'inventory', permission: 'warehouses.view' },
      { label: 'Products', href: '/products', domain: 'inventory', permission: 'products.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Attendance', href: '/attendance', domain: 'attendance', permission: 'attendance.check_in' },
      { label: 'Leave', href: '/leave', domain: 'attendance', permission: 'leave.request' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Reports', href: '/reports', domain: 'admin', permission: 'reports.view' },
      { label: 'Users', href: '/users', domain: 'admin', permission: 'users.view' },
      { label: 'Permissions', href: '/permissions', domain: 'admin', permission: 'roles.manage' },
      { label: 'Audit log', href: '/audit', domain: 'admin', permission: 'audit.view' },
      { label: 'Administration', href: '/admin', domain: 'admin', permission: 'settings.manage' },
    ],
  },
];

/** Glyph set. Geometric marks rather than an icon font — they
 *  stay legible at 14px and carry no third-party dependency. */
export function Glyph({ name }: { name: string }) {
  const p: Record<string, ReactNode> = {
    accounts: <><path d="M2 5h12v7H2z" /><path d="M2 8h12" /></>,
    bills: <><path d="M4 2h8v12l-2-1.2L8 14l-2-1.2L4 14z" /><path d="M6 6h4M6 9h4" /></>,
    clients: <><circle cx="8" cy="6" r="2.4" /><path d="M3.5 13a4.5 4.5 0 0 1 9 0" /></>,
    vendors: <><path d="M2.5 6.5h11v6h-11z" /><path d="M5 6.5V4h6v2.5" /></>,
    projects: <><path d="M2.5 4.5h5l1 1.5h5v7h-11z" /></>,
    storage: <><path d="M2.5 6 8 3l5.5 3v7h-11z" /><path d="M6.5 13V9h3v4" /></>,
    products: <><path d="M8 2.5 13.5 5.5v5L8 13.5 2.5 10.5v-5z" /><path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" /></>,
    attendance: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2.2 1.3" /></>,
    leave: <><path d="M2.5 4.5h11v9h-11z" /><path d="M2.5 7h11M5.5 3v3M10.5 3v3" /></>,
    reports: <><path d="M3 13V7M6.5 13V4M10 13V9M13.5 13V6" /></>,
    users: <><circle cx="6" cy="6" r="2.2" /><path d="M2 13a4 4 0 0 1 8 0" /><path d="M11 5.2a2.2 2.2 0 0 1 0 4.4" /></>,
    permissions: <><path d="M8 2.5 13 4.6v3.6c0 3-2.1 4.8-5 5.8-2.9-1-5-2.8-5-5.8V4.6z" /><path d="M6 8l1.6 1.6L10.4 6.8" /></>,
    audit: <><path d="M3.5 2.5h6l3 3v8h-9z" /><path d="M9.5 2.5v3h3M5.5 8h5M5.5 10.5h3" /></>,
    admin: <><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4" /></>,
    dashboard: <><path d="M2.5 2.5h5v5h-5zM8.5 2.5h5v3h-5zM8.5 6.5h5v7h-5zM2.5 8.5h5v5h-5z" /></>,
    bell: <><path d="M8 2a3.6 3.6 0 0 0-3.6 3.6c0 3.2-1.2 4.2-1.2 4.2h9.6s-1.2-1-1.2-4.2A3.6 3.6 0 0 0 8 2z" /><path d="M6.7 12a1.5 1.5 0 0 0 2.6 0" /></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      className="gts-icon-fixed" aria-hidden="true" style={{ flex: 'none' }}>
      {p[name] ?? p.dashboard}
    </svg>
  );
}

const slug = (href: string) => href.replace('/', '') || 'dashboard';

/**
 * The application shell.
 *
 * A server component: it resolves the actor itself rather than being
 * handed one, so no page can forget to pass it and end up rendering a
 * signed-out chrome around signed-in content.
 */
export async function Shell({
  children,
  active,
  domain = 'finance',
}: {
  children: ReactNode;
  active: string;
  domain?: Domain;
}) {
  const actor = await getActor();

  // Every page inside the shell is behind middleware and its own guard,
  // so this is defensive: render nothing rather than a broken chrome.
  if (!actor) return <>{children}</>;

  const unread = await unreadCount(actor.id);

  const visibleGroups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(actor, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="gts-shell">
      <nav className="gts-rail" aria-label="Primary">
        <div className="gts-rail-head">
          <span className="gts-rail-mark">
            GTS<span style={{ color: 'var(--gts-accent)' }}>.</span>
          </span>
        </div>

        {/* The links scroll; the brand above and the identity block
            below stay put, so a long navigation cannot push "who am I
            signed in as" off the bottom of the rail. */}
        <div className="gts-rail-nav">
          <a href="/dashboard" className="gts-nav-item"
            aria-current={active === '/dashboard' ? 'page' : undefined}>
            <Glyph name="dashboard" />Dashboard
          </a>

          <a href="/notifications" className="gts-nav-item"
            aria-current={active === '/notifications' ? 'page' : undefined}>
            <Glyph name="bell" />
            Notifications
            {unread > 0 && (
              <span className="gts-nav-count" aria-label={`${unread} unread`}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </a>

          {visibleGroups.map((g) => (
            <div className="gts-nav-group" key={g.label}>
              <p className="gts-nav-group-label">{g.label}</p>
              {g.items.map((it) => (
                <a key={it.href} href={it.href} className="gts-nav-item"
                  data-domain={it.domain}
                  aria-current={active === it.href ? 'page' : undefined}>
                  <Glyph name={slug(it.href)} />{it.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <UserMenu
          nameEn={actor.nameEn}
          email={actor.email}
          roleName={actor.roleNameEn}
        />
      </nav>

      <div className="gts-main" data-domain={domain}>
        {children}
      </div>

      {/* Mobile: 5 destinations, Attendance centre and raised. */}
      <nav className="gts-mobile-nav" aria-label="Primary mobile">
        <a href="/dashboard" className="gts-mobile-nav-item"
          aria-current={active === '/dashboard' ? 'page' : undefined}>
          <Glyph name="dashboard" />Home
        </a>
        {can(actor, 'projects.view') && (
          <a href="/projects" className="gts-mobile-nav-item"
            aria-current={active === '/projects' ? 'page' : undefined}>
            <Glyph name="projects" />Projects
          </a>
        )}
        {can(actor, 'attendance.check_in') && (
          <a href="/attendance" className="gts-mobile-nav-item"
            aria-current={active === '/attendance' ? 'page' : undefined}>
            <Glyph name="attendance" />Check in
          </a>
        )}
        {can(actor, 'bills.view') && (
          <a href="/bills" className="gts-mobile-nav-item"
            aria-current={active === '/bills' ? 'page' : undefined}>
            <Glyph name="bills" />Bills
          </a>
        )}
        <a href="/notifications" className="gts-mobile-nav-item"
          aria-current={active === '/notifications' ? 'page' : undefined}>
          <Glyph name="bell" />
          Alerts
          {unread > 0 && <span className="gts-mobile-nav-dot" aria-hidden="true" />}
        </a>
      </nav>
    </div>
  );
}

/* ---- Page header: used by every module ---- */
export function PageHead({
  overline,
  title,
  lede,
  actions,
}: {
  overline: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-end', gap: 'var(--gts-space-6)', flexWrap: 'wrap',
    }}>
      <div style={{ minInlineSize: 0 }}>
        <p className="gts-overline">{overline}</p>
        <h1 className="gts-page-title" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
          {title}
        </h1>
        {lede && (
          <p style={{
            font: 'var(--gts-role-body)', color: 'var(--gts-fg-secondary)',
            maxInlineSize: 'var(--gts-prose-max)', marginBlockStart: 'var(--gts-space-3)',
          }}>{lede}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 'var(--gts-space-2)', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </header>
  );
}

/* ---- Empty state: typographic, names object + next action ---- */
export function Empty({
  title, body, action, filtered = false,
}: { title: string; body: string; action?: ReactNode; filtered?: boolean }) {
  return (
    <div className={`gts-empty${filtered ? ' gts-empty-filtered' : ''}`}>
      <span className="gts-empty-mark" />
      <h3 className="gts-empty-title">{title}</h3>
      <p className="gts-empty-body">{body}</p>
      {action}
    </div>
  );
}

export type { Actor };
