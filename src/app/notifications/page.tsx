import type { Metadata } from 'next';

import { Shell, PageHead, Empty } from '@/components/shell';
import { Status } from '@/components/primitives';
import { Icon } from '@/components/icon';
import { requireActor } from '@/lib/auth';
import { listNotifications } from '@/lib/services/notifications';
import { formatDate, formatSiteTime } from '@/lib/format';
import { getLocale } from '@/lib/preferences';
import { t } from '@/lib/i18n';

import { MarkAllRead, NotificationLink } from './notification-forms';

export const metadata: Metadata = { title: 'Notifications — GTS' };
export const dynamic = 'force-dynamic';

/**
 * NOTIFICATIONS.
 *
 * Fanned out to whoever holds the permission that governs the event —
 * "anyone who can approve a bill" is the right audience for a bill
 * awaiting approval, and naming individuals would go stale the moment
 * somebody changes role.
 *
 * No permission guard beyond being signed in: these are YOUR
 * notifications, and the query is scoped to your user id.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ unread?: string }>;
}) {
  const actor = await requireActor();
  const params = await searchParams;
  const dict = await t();
  const locale = await getLocale();

  const unreadOnly = params.unread === '1';
  const notifications = await listNotifications(actor.id, { unreadOnly, limit: 100 });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <Shell active="/notifications" domain="admin">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={dict.overview.notifications.yourWorkspace}
          title={dict.overview.notifications.title}
          lede={
            unread > 0
              ? `${unread} ${dict.overview.notifications.unread}`
              : dict.overview.notifications.allRead
          }
          actions={unread > 0 ? <MarkAllRead dict={{ markAllRead: dict.overview.notifications.markAllRead, marking: dict.overview.notifications.marking }} /> : undefined}
        />

        <form method="get" className="bg-surface rounded-lg border border-line shadow-raised p-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-fg-secondary h-touch">
            <input type="checkbox" name="unread" value="1" defaultChecked={unreadOnly} className="accent-brand" />
            {dict.overview.notifications.unreadOnly}
          </label>
          <button
            type="submit"
            className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors"
          >
            {dict.overview.notifications.apply}
          </button>
        </form>

        {notifications.length === 0 ? (
          <div className="bg-surface rounded-lg border border-line shadow-raised">
            <Empty
              title={unreadOnly ? dict.overview.notifications.nothingUnread : dict.overview.notifications.nothingYet}
              body={
                unreadOnly
                  ? dict.overview.notifications.nothingUnreadBody
                  : dict.overview.notifications.nothingYetBody
              }
              filtered={unreadOnly}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {notifications.map((notification) => {
              const tone = kindTone(notification.kind);
              return (
                <li
                  key={notification.id}
                  className={`bg-surface rounded-lg border shadow-raised p-4 flex items-start gap-4 ${
                    notification.readAt ? 'border-line' : 'border-accent'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${toneBg(tone)}`}>
                    <Icon name={kindIcon(notification.kind)} size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {notification.href ? (
                        <NotificationLink id={notification.id} href={notification.href}>
                          {notification.titleEn}
                        </NotificationLink>
                      ) : (
                        notification.titleEn
                      )}
                    </p>
                    <p className="text-xs text-fg-secondary mt-1">{notification.bodyEn}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <Status tone={tone}>
                      {notification.kind.toLowerCase().replace(/_/g, ' ')}
                    </Status>
                    <span className="text-2xs text-fg-muted whitespace-nowrap">
                      {formatDate(notification.createdAt.toISOString(), locale)}{' '}
                      {formatSiteTime(notification.createdAt.toISOString(), locale)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </Shell>
  );
}

function kindTone(kind: string) {
  if (kind === 'BILL_OVERDUE' || kind === 'ATTENDANCE_ISSUE') return 'danger' as const;
  if (kind === 'LOW_INVENTORY' || kind === 'BILL_PENDING_APPROVAL' || kind === 'LEAVE_REQUESTED')
    return 'warning' as const;
  if (kind === 'PAYMENT_RECEIVED' || kind === 'BILL_APPROVED') return 'success' as const;
  return 'info' as const;
}

function kindIcon(kind: string) {
  if (kind === 'BILL_OVERDUE') return 'receipt_long';
  if (kind === 'ATTENDANCE_ISSUE') return 'warning';
  if (kind === 'LOW_INVENTORY') return 'inventory_2';
  if (kind === 'BILL_PENDING_APPROVAL') return 'pending_actions';
  if (kind === 'LEAVE_REQUESTED') return 'event_busy';
  if (kind === 'PAYMENT_RECEIVED') return 'payments';
  if (kind === 'BILL_APPROVED') return 'check_circle';
  return 'notifications';
}

function toneBg(tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral') {
  if (tone === 'danger') return 'bg-danger-bg text-danger';
  if (tone === 'warning') return 'bg-warning-bg text-warning';
  if (tone === 'success') return 'bg-success-bg text-success';
  if (tone === 'info') return 'bg-info-bg text-info';
  return 'bg-inset text-fg-muted';
}
