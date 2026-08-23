import type { Metadata } from 'next';

import { Shell, PageHead, Empty } from '@/components/shell';
import { Status } from '@/components/primitives';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDate, formatSiteTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

export const metadata: Metadata = { title: 'Audit log — GTS' };
export const dynamic = 'force-dynamic';

const ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
  'APPROVE', 'REJECT', 'CANCEL', 'SEND', 'PAYMENT',
  'INVENTORY_MOVE', 'LOCATION_CHANGE', 'PERMISSION_CHANGE',
  'CHECK_IN', 'CHECK_OUT',
  'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE',
] as const;

const PAGE_SIZE = 100;

/**
 * AUDIT LOG — who did what.
 *
 * Append-only, and written inside the same transaction as the change it
 * describes: an action cannot succeed while its audit entry silently
 * fails. Entries record only the fields that CHANGED, which is what
 * makes "what did this person alter?" answerable at a glance rather than
 * a diff against a full row snapshot.
 *
 * Failed sign-ins appear here with no actor. That is deliberate — an
 * attempt against an address that does not exist is exactly the event
 * worth keeping.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; entity?: string; page?: string }>;
}) {
  await requirePermission('audit.view');
  const params = await searchParams;
  const dict = await t();
  const locale = await getLocale();

  const action = ACTIONS.includes(params.action as (typeof ACTIONS)[number])
    ? params.action
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const where = {
    ...(action ? { action } : {}),
    ...(params.actor ? { actorId: params.actor } : {}),
    ...(params.entity ? { entityType: params.entity } : {}),
  };

  const [entries, total, actors, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { id: true, nameEn: true, email: true } } },
    }),
    db.auditLog.count({ where }),
    db.user.findMany({
      where: { deletedAt: null },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    }),
    db.auditLog.groupBy({ by: ['entityType'], _count: true, orderBy: { entityType: 'asc' } }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const query = (over: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...over })) {
      if (value !== undefined && value !== '') next.set(key, String(value));
    }
    const q = next.toString();
    return q ? `/audit?${q}` : '/audit';
  };

  return (
    <Shell active="/audit" domain="admin">
      <main className="gts-page">
        <PageHead
          overline={dict.admin.audit.overline}
          title={dict.admin.audit.title}
          lede={`${total.toLocaleString('en-US')} ${dict.admin.audit.lede}`}
        />

        <form method="get" className="gts-filter-bar">
          <div className="gts-field">
            <label className="gts-sr" htmlFor="action">
              {dict.admin.audit.filter.actionLabel}
            </label>
            <select id="action" name="action" defaultValue={action ?? ''} className="gts-input gts-select">
              <option value="">{dict.admin.audit.filter.anyAction}</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a.toLowerCase().replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="gts-field">
            <label className="gts-sr" htmlFor="actor">
              {dict.admin.audit.filter.personLabel}
            </label>
            <select id="actor" name="actor" defaultValue={params.actor ?? ''} className="gts-input gts-select">
              <option value="">{dict.admin.audit.filter.anybody}</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="gts-field">
            <label className="gts-sr" htmlFor="entity">
              {dict.admin.audit.filter.recordLabel}
            </label>
            <select id="entity" name="entity" defaultValue={params.entity ?? ''} className="gts-input gts-select">
              <option value="">{dict.admin.audit.filter.anyRecord}</option>
              {entityTypes.map((e) => (
                <option key={e.entityType} value={e.entityType}>
                  {e.entityType} ({e._count})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="gts-btn gts-btn-secondary">
            {dict.admin.audit.filter.filterButton}
          </button>
          {(action || params.actor || params.entity) && (
            <a href="/audit" className="gts-btn gts-btn-ghost">
              {dict.admin.audit.filter.clearButton}
            </a>
          )}
        </form>

        {entries.length === 0 ? (
          <Empty
            title={dict.admin.audit.emptyTitle}
            body={
              action || params.actor || params.entity
                ? dict.admin.audit.emptyBodyFiltered
                : dict.admin.audit.emptyBodyDefault
            }
            filtered={Boolean(action || params.actor || params.entity)}
          />
        ) : (
          <>
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-compact">
                <caption className="gts-sr">{dict.admin.audit.tableCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{dict.admin.audit.table.when}</th>
                    <th scope="col">{dict.admin.audit.table.who}</th>
                    <th scope="col">{dict.admin.audit.table.action}</th>
                    <th scope="col">{dict.admin.audit.table.record}</th>
                    <th scope="col">{dict.admin.audit.table.whatChanged}</th>
                    <th scope="col">{dict.admin.audit.table.from}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row">
                        {formatDate(entry.createdAt.toISOString(), locale)}
                        <span className="gts-meta gts-cell-sub">
                          {formatSiteTime(entry.createdAt.toISOString(), locale)}
                        </span>
                      </th>
                      <td>
                        {entry.actor ? (
                          entry.actor.nameEn
                        ) : (
                          // No actor: a failed sign-in, before anybody
                          // was authenticated. The attempted address is
                          // still recorded.
                          <span className="gts-meta">
                            {entry.actorEmail ?? dict.admin.audit.notSignedIn}
                          </span>
                        )}
                      </td>
                      <td>
                        <Status tone={actionTone(entry.action)}>
                          {entry.action.toLowerCase().replace(/_/g, ' ')}
                        </Status>
                      </td>
                      <td>
                        {entry.entityType}
                        {entry.entityId && (
                          <span className="gts-meta gts-cell-sub">
                            <bdi>{entry.entityId.slice(-8)}</bdi>
                          </span>
                        )}
                      </td>
                      <td>{entry.summary ?? <span className="gts-meta">—</span>}</td>
                      <td>
                        <span className="gts-meta">
                          <bdi>{entry.ipAddress ?? '—'}</bdi>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <nav className="gts-pagination" aria-label={dict.admin.audit.pagination.label}>
                {page > 1 && (
                  <a href={query({ page: page - 1 })} className="gts-btn gts-btn-secondary">
                    {dict.admin.audit.pagination.newer}
                  </a>
                )}
                <span className="gts-meta">
                  {dict.admin.audit.pagination.pageOf
                    .replace('{page}', String(page))
                    .replace('{pages}', String(pages))}
                </span>
                {page < pages && (
                  <a href={query({ page: page + 1 })} className="gts-btn gts-btn-secondary">
                    {dict.admin.audit.pagination.older}
                  </a>
                )}
              </nav>
            )}
          </>
        )}
      </main>
    </Shell>
  );
}

function actionTone(action: string) {
  if (action === 'DELETE' || action === 'REJECT' || action === 'LOGIN_FAILED') return 'danger' as const;
  if (action === 'APPROVE' || action === 'PAYMENT' || action === 'LOGIN') return 'success' as const;
  if (action === 'PERMISSION_CHANGE' || action === 'LOCATION_CHANGE' || action === 'CANCEL')
    return 'warning' as const;
  return 'info' as const;
}
