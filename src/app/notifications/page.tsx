import type { Metadata } from 'next';

import { Shell, PageHead, Empty } from '@/components/shell';
import { Status } from '@/components/primitives';
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
      <main className="gts-page">
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

        <form method="get" className="gts-filter-bar">
          <label className="gts-check">
            <input type="checkbox" name="unread" value="1" defaultChecked={unreadOnly} />
            {dict.overview.notifications.unreadOnly}
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            {dict.overview.notifications.apply}
          </button>
        </form>

        {notifications.length === 0 ? (
          <Empty
            title={unreadOnly ? dict.overview.notifications.nothingUnread : dict.overview.notifications.nothingYet}
            body={
              unreadOnly
                ? dict.overview.notifications.nothingUnreadBody
                : dict.overview.notifications.nothingYetBody
            }
            filtered={unreadOnly}
          />
        ) : (
          <ul className="gts-notification-list">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="gts-notification"
                data-unread={notification.readAt ? undefined : 'true'}
              >
                <div style={{ minInlineSize: 0 }}>
                  <p className="gts-notification-title">
                    {notification.href ? (
                      <NotificationLink id={notification.id} href={notification.href}>
                        {notification.titleEn}
                      </NotificationLink>
                    ) : (
                      notification.titleEn
                    )}
                  </p>
                  <p className="gts-meta">{notification.bodyEn}</p>
                </div>
                <div className="gts-notification-aside">
                  <Status tone={kindTone(notification.kind)}>
                    {notification.kind.toLowerCase().replace(/_/g, ' ')}
                  </Status>
                  <span className="gts-meta">
                    {formatDate(notification.createdAt.toISOString(), locale)}{' '}
                    {formatSiteTime(notification.createdAt.toISOString(), locale)}
                  </span>
                </div>
              </li>
            ))}
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
