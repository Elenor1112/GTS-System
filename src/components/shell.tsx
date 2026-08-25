import type { ReactNode } from 'react';
import Image from 'next/image';

import { getActor, type Actor } from '@/lib/auth';
import { can, type PermissionKey } from '@/lib/permissions';
import { unreadCount } from '@/lib/services/notifications';
import { getTheme, getLocale } from '@/lib/preferences';
import { t, type Dictionary } from '@/lib/i18n';
import { UserMenu } from './user-menu';
import { MobileMore } from './mobile-more';
import { Icon } from './icon';
import { NavGroup } from './nav-group';

/** Re-exported for the pre-existing exploratory dashboard/preview-a
 *  and preview-b routes only — not used by the restyled shell or any
 *  of the 18 Stitch-matched screens. Left in place rather than
 *  breaking those routes' build; see glyph.tsx removal notes. */
export { Glyph } from './glyph';

/* ============================================================
   APP SHELL — light sidebar + top bar, matching the Stitch
   "GTS Egypt Business OS" reference (projects.html carries the
   canonical nav/topbar/footer markup; every other screen repeats
   it verbatim).

   Navigation is PERMISSION-AWARE: a storekeeper does not see
   an Accounts link they would only be refused at. That is a
   courtesy, not a control — every one of these routes checks
   its own permission server-side regardless of what the rail
   chose to render.

   Mobile is a different architecture, not a shrunk rail —
   five destinations plus overflow, with Attendance centre
   because it is the daily action. Stitch supplied no mobile
   mockup, so the mobile bar keeps its existing behaviour and is
   reskinned to the new tokens/icons for visual consistency.
   ============================================================ */

export type Domain =
  | 'finance' | 'inventory' | 'projects' | 'clients'
  | 'vendors' | 'attendance' | 'admin';

type NavKey = Exclude<keyof Dictionary['nav'], 'more' | 'home' | 'checkIn' | 'alerts' | 'account' | 'signOut'
  | 'accounting' | 'warehouses' | 'humanResources' | 'system' | 'notifications' | 'dashboard'>;
type NavItem = { labelKey: NavKey; href: string; domain: Domain; permission: PermissionKey };
type NavGroupKey = 'accounting' | 'warehouses' | 'humanResources' | 'system';
type NavGroup = { labelKey: NavGroupKey; items: NavItem[] };

/** Material Symbol for each category dropdown's own trigger row. */
const NAV_GROUP_ICON: Record<NavGroupKey, string> = {
  accounting: 'account_balance',
  warehouses: 'inventory_2',
  humanResources: 'badge',
  system: 'settings',
};

/** Material Symbol name for each nav destination, taken from
 *  the Stitch sidebar markup (projects.html). Keyed loosely
 *  (not against NavKey) since it also covers `dashboard`, which
 *  is rendered outside the permission-filtered NAV items. */
const NAV_ICON: Record<NavKey | 'dashboard', string> = {
  dashboard: 'dashboard',
  accounts: 'account_balance',
  bills: 'receipt_long',
  clients: 'groups',
  vendors: 'factory',
  projects: 'account_tree',
  storage: 'inventory_2',
  products: 'inventory',
  employees: 'badge',
  attendance: 'location_on',
  leave: 'event_busy',
  reports: 'bar_chart',
  users: 'person_outline',
  permissions: 'vpn_key',
  audit: 'history',
  admin: 'settings',
};

export const NAV: NavGroup[] = [
  {
    labelKey: 'accounting',
    items: [
      { labelKey: 'accounts', href: '/accounts', domain: 'finance', permission: 'accounts.view' },
      { labelKey: 'bills', href: '/bills', domain: 'finance', permission: 'bills.view' },
      { labelKey: 'clients', href: '/clients', domain: 'clients', permission: 'clients.view' },
      { labelKey: 'vendors', href: '/vendors', domain: 'vendors', permission: 'vendors.view' },
    ],
  },
  {
    labelKey: 'warehouses',
    items: [
      { labelKey: 'projects', href: '/projects', domain: 'projects', permission: 'projects.view' },
      { labelKey: 'storage', href: '/storage', domain: 'inventory', permission: 'warehouses.view' },
      { labelKey: 'products', href: '/products', domain: 'inventory', permission: 'products.view' },
    ],
  },
  {
    labelKey: 'humanResources',
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
    <div className="flex min-h-dvh bg-page text-fg">
      {/* Desktop sidebar — fixed, w-64, matches Stitch's SideNavBar */}
      <nav
        className="hidden md:flex flex-col fixed inset-y-0 start-0 z-40 w-rail bg-surface shadow-[1px_0_0_0_rgba(0,0,0,0.04)]"
        aria-label="Primary"
      >
        <div className="p-6 flex items-center gap-3">
          <a href="/dashboard" className="block py-1.5 shrink-0" aria-label="GTS home">
            <Image
              src="/logo-mark.png"
              alt="GTS"
              width={1244}
              height={361}
              priority
              className="h-8 w-auto"
            />
          </a>
        </div>

        <div className="p-4">
          <a
            href="/bills/new"
            className="w-full h-touch px-4 bg-brand text-fg-on-accent rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity font-medium text-sm"
          >
            <Icon name="add" />
            New Transaction
          </a>
        </div>

        {/* The links scroll; the brand above and the identity block
            below stay put, so a long navigation cannot push "who am I
            signed in as" off the bottom of the rail. */}
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
          <NavLink href="/dashboard" active={active === '/dashboard'} icon={NAV_ICON.dashboard}>
            {dict.nav.dashboard}
          </NavLink>
          {visibleGroups.map((group) => (
            <NavGroup
              key={group.labelKey}
              label={dict.nav[group.labelKey]}
              icon={NAV_GROUP_ICON[group.labelKey]}
              defaultOpen={group.items.some((it) => active === it.href)}
            >
              {group.items.map((it) => (
                <NavLink key={it.href} href={it.href} active={active === it.href} icon={NAV_ICON[it.labelKey]}>
                  {dict.nav[it.labelKey]}
                </NavLink>
              ))}
            </NavGroup>
          ))}
        </div>

        <UserMenu
          nameEn={actor.nameEn}
          email={actor.email}
          roleName={actor.roleNameEn}
          theme={theme}
          locale={locale}
          dict={{
            preferences: dict.preferences,
            nav: { account: dict.nav.account, signOut: dict.nav.signOut },
          }}
        />
      </nav>

      {/* Main column */}
      <div className="flex-1 flex flex-col ms-0 md:ms-rail min-w-0" data-domain={domain}>
        {/* Top bar — fixed, matches Stitch's TopNavBar */}
        <header className="fixed top-0 inset-x-0 md:start-rail z-30 flex justify-between items-center gap-4 px-6 h-topbar bg-raised border-b border-line">
          <div className="flex items-center gap-4 min-w-0">
            <Image
              src="/logo-mark.png"
              alt="GTS"
              width={1244}
              height={361}
              className="h-6 w-auto shrink-0 py-1 hidden md:block"
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="p-2 text-fg-secondary hover:text-brand-fg transition-colors" aria-label="Help">
              <Icon name="help" />
            </button>
            <a href="/notifications" className="p-2 text-fg-secondary hover:text-brand-fg transition-colors relative" aria-label={dict.nav.notifications}>
              <Icon name="notifications" />
              {unread > 0 && <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-danger" aria-hidden="true" />}
            </a>
            <a href="/account" className="p-2 text-fg-secondary hover:text-brand-fg transition-colors" aria-label={dict.nav.account}>
              <Icon name="settings" />
            </a>
            <span className="w-8 h-8 rounded-full bg-inset overflow-hidden border border-line flex items-center justify-center text-xs font-semibold text-fg-secondary shrink-0">
              {actor.nameEn.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
            </span>
          </div>
        </header>

        <main className="flex-1 pt-topbar pb-20 md:pb-10 min-w-0">{children}</main>

        {/* Footer — matches Stitch's status bar */}
        <footer className="hidden md:flex fixed bottom-0 inset-x-0 md:start-rail h-8 items-center justify-between px-6 z-20 border-t border-line bg-sunken text-2xs text-fg-secondary">
          <span>© {new Date().getFullYear()} GTS Business OS · System: Healthy</span>
        </footer>
      </div>

      {/* Mobile: 4 primary destinations + More, which opens every other
          permitted item from the same NAV the rail renders — the two
          stop diverging. */}
      <nav className="gts-mobile-nav" aria-label="Primary mobile">
        <a href="/dashboard" className="gts-mobile-nav-item"
          aria-current={active === '/dashboard' ? 'page' : undefined}>
          <Icon name={NAV_ICON.dashboard} />{dict.nav.home}
        </a>
        {can(actor, 'projects.view') && (
          <a href="/projects" className="gts-mobile-nav-item"
            aria-current={active === '/projects' ? 'page' : undefined}>
            <Icon name={NAV_ICON.projects} />{dict.nav.projects}
          </a>
        )}
        {can(actor, 'attendance.check_in') && (
          <a href="/attendance" className="gts-mobile-nav-item"
            aria-current={active === '/attendance' ? 'page' : undefined}>
            <Icon name={NAV_ICON.attendance} />{dict.nav.checkIn}
          </a>
        )}
        {can(actor, 'bills.view') && (
          <a href="/bills" className="gts-mobile-nav-item"
            aria-current={active === '/bills' ? 'page' : undefined}>
            <Icon name={NAV_ICON.bills} />{dict.nav.bills}
          </a>
        )}
        <a href="/notifications" className="gts-mobile-nav-item"
          aria-current={active === '/notifications' ? 'page' : undefined}>
          <Icon name="notifications" />
          {dict.nav.alerts}
          {unread > 0 && <span className="gts-mobile-nav-dot" aria-hidden="true" />}
        </a>
        <MobileMore
          groups={[
            { label: dict.nav.notifications, items: [{ label: dict.nav.notifications, href: '/notifications', icon: 'notifications', active: active === '/notifications' }] },
            ...visibleGroups.map((g) => ({
              label: dict.nav[g.labelKey],
              items: g.items.map((it) => ({
                label: dict.nav[it.labelKey], href: it.href, icon: NAV_ICON[it.labelKey], active: active === it.href,
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

/** One sidebar link. Active state = teal secondary-container fill +
 *  bold text, exactly Stitch's `bg-secondary-container text-on-
 *  secondary-container font-bold` treatment. */
function NavLink({
  href,
  active,
  icon,
  small = false,
  children,
}: {
  href: string;
  active: boolean;
  icon: string;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-sm font-medium transition-colors ${
        small ? 'px-4 py-2 text-sm' : 'px-4 py-3 text-sm'
      } ${
        active
          ? 'bg-selected text-fg font-bold'
          : 'text-fg-secondary hover:bg-hover'
      }`}
    >
      <Icon name={icon} filled={active} />
      {children}
    </a>
  );
}

/* ---- Page header: used by every module. Matches Stitch's
   per-page header — headline-lg title, a lede, and a right-aligned
   primary action, seen consistently across bills/accounts/clients
   etc. ---- */
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
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide uppercase text-fg-muted mb-1">{overline}</p>
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        {lede && <p className="text-sm text-fg-secondary mt-2 max-w-prose">{lede}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

/* ---- Empty state: typographic, names object + next action ---- */
export function Empty({
  title, body, action, filtered = false,
}: { title: string; body: string; action?: ReactNode; filtered?: boolean }) {
  return (
    <div className={`flex flex-col items-start gap-3 py-12 px-6 max-w-prose ${filtered ? 'opacity-80' : ''}`}>
      <span className="w-8 h-0.5 bg-accent mb-2" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      <p className="text-sm text-fg-secondary">{body}</p>
      {action}
    </div>
  );
}

export type { Actor };
