import type { ReactNode } from 'react';

import { getActor, type Actor } from '@/lib/auth';
import { can, type PermissionKey } from '@/lib/permissions';
import { unreadCount } from '@/lib/services/notifications';
import { getTheme, getLocale } from '@/lib/preferences';
import { t, type Dictionary } from '@/lib/i18n';
import { UserMenu } from './user-menu';
import { MobileMore } from './mobile-more';
import { Glyph } from './glyph';

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

type NavKey = Exclude<keyof Dictionary['nav'], 'more' | 'home' | 'checkIn' | 'alerts' | 'account' | 'signOut'>;
type NavItem = { labelKey: NavKey; href: string; domain: Domain; permission: PermissionKey };
type NavGroup = { labelKey: 'financial' | 'operations' | 'people' | 'system'; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    labelKey: 'financial',
    items: [
      { labelKey: 'accounts', href: '/accounts', domain: 'finance', permission: 'accounts.view' },
      { labelKey: 'bills', href: '/bills', domain: 'finance', permission: 'bills.view' },
      { labelKey: 'clients', href: '/clients', domain: 'clients', permission: 'clients.view' },
      { labelKey: 'vendors', href: '/vendors', domain: 'vendors', permission: 'vendors.view' },
    ],
  },
  {
    labelKey: 'operations',
    items: [
      { labelKey: 'projects', href: '/projects', domain: 'projects', permission: 'projects.view' },
      { labelKey: 'storage', href: '/storage', domain: 'inventory', permission: 'warehouses.view' },
      { labelKey: 'products', href: '/products', domain: 'inventory', permission: 'products.view' },
    ],
  },
  {
    labelKey: 'people',
    items: [
      { labelKey: 'employees', href: '/employees', domain: 'attendance', permission: 'employees.view' },
      { labelKey: 'attendance', href: '/attendance', domain: 'attendance', permission: 'attendance.check_in' },
      { labelKey: 'leave', href: '/leave', domain: 'attendance', permission: 'leave.request' },
    ],
  },
  {
    labelKey: 'system',
    items: [
      { labelKey: 'reports', href: '/reports', domain: 'admin', permission: 'reports.view' },
      { labelKey: 'users', href: '/users', domain: 'admin', permission: 'users.view' },
      { labelKey: 'permissions', href: '/permissions', domain: 'admin', permission: 'roles.manage' },
      { labelKey: 'audit', href: '/audit', domain: 'admin', permission: 'audit.view' },
      { labelKey: 'admin', href: '/admin', domain: 'admin', permission: 'settings.manage' },
    ],
  },
];

export { Glyph } from './glyph';

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

  const [unread, theme, locale, dict] = await Promise.all([
    unreadCount(actor.id),
    getTheme(),
    getLocale(),
    t(),
  ]);

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
            <Glyph name="dashboard" />{dict.nav.dashboard}
          </a>

          <a href="/notifications" className="gts-nav-item"
            aria-current={active === '/notifications' ? 'page' : undefined}>
            <Glyph name="bell" />
            {dict.nav.notifications}
            {unread > 0 && (
              <span className="gts-nav-count" aria-label={`${unread} unread`}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </a>

          {visibleGroups.map((g) => (
            <div className="gts-nav-group" key={g.labelKey}>
              <p className="gts-nav-group-label">{dict.nav[g.labelKey]}</p>
              {g.items.map((it) => (
                <a key={it.href} href={it.href} className="gts-nav-item"
                  data-domain={it.domain}
                  aria-current={active === it.href ? 'page' : undefined}>
                  <Glyph name={slug(it.href)} />{dict.nav[it.labelKey]}
                </a>
              ))}
            </div>
          ))}
        </div>

        <UserMenu
          nameEn={actor.nameEn}
          email={actor.email}
          roleName={actor.roleNameEn}
          theme={theme}
          locale={locale}
          dict={dict}
        />
      </nav>

      <div className="gts-main" data-domain={domain}>
        {children}
      </div>

      {/* Mobile: 4 primary destinations + More, which opens every other
          permitted item from the same NAV the rail renders — the two
          stop diverging. */}
      <nav className="gts-mobile-nav" aria-label="Primary mobile">
        <a href="/dashboard" className="gts-mobile-nav-item"
          aria-current={active === '/dashboard' ? 'page' : undefined}>
          <Glyph name="dashboard" />{dict.nav.home}
        </a>
        {can(actor, 'projects.view') && (
          <a href="/projects" className="gts-mobile-nav-item"
            aria-current={active === '/projects' ? 'page' : undefined}>
            <Glyph name="projects" />{dict.nav.projects}
          </a>
        )}
        {can(actor, 'attendance.check_in') && (
          <a href="/attendance" className="gts-mobile-nav-item"
            aria-current={active === '/attendance' ? 'page' : undefined}>
            <Glyph name="attendance" />{dict.nav.checkIn}
          </a>
        )}
        {can(actor, 'bills.view') && (
          <a href="/bills" className="gts-mobile-nav-item"
            aria-current={active === '/bills' ? 'page' : undefined}>
            <Glyph name="bills" />{dict.nav.bills}
          </a>
        )}
        <a href="/notifications" className="gts-mobile-nav-item"
          aria-current={active === '/notifications' ? 'page' : undefined}>
          <Glyph name="bell" />
          {dict.nav.alerts}
          {unread > 0 && <span className="gts-mobile-nav-dot" aria-hidden="true" />}
        </a>
        <MobileMore
          groups={[
            { label: dict.nav.notifications, items: [{ label: dict.nav.notifications, href: '/notifications', icon: 'bell', active: active === '/notifications' }] },
            ...visibleGroups.map((g) => ({
              label: dict.nav[g.labelKey],
              items: g.items.map((it) => ({
                label: dict.nav[it.labelKey], href: it.href, icon: slug(it.href), active: active === it.href,
              })),
            })),
          ]}
          nameEn={actor.nameEn}
          email={actor.email}
          roleName={actor.roleNameEn}
          triggerActive={!['/dashboard', '/projects', '/attendance', '/bills', '/notifications'].includes(active)}
          strings={{ account: dict.nav.account, signOut: dict.nav.signOut, more: dict.nav.more }}
        />
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
    <header className="gts-page-head">
      <div className="gts-page-head-main">
        <p className="gts-overline">{overline}</p>
        <h1 className="gts-page-title gts-page-head-title">{title}</h1>
        {lede && <p className="gts-page-head-lede">{lede}</p>}
      </div>
      {actions && <div className="gts-page-head-actions">{actions}</div>}
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
