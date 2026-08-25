import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { outstandingOf } from '@/lib/services/billing';
import { daysOverdue } from '@/lib/services/accounts';
import { formatDate, formatMoney } from '@/lib/format';
import { CURRENCY, VAT_STANDARD } from '@/lib/egypt';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

export const metadata: Metadata = { title: 'Electronic bills — GTS' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT',
  'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED',
] as const;

/**
 * ELECTRONIC BILLS — the document register.
 *
 * Receivables and payables in one register, filtered by direction,
 * because the question "what is outstanding" spans both and the ageing
 * arithmetic is identical.
 *
 * Every total shown was computed server-side from the bill's own line
 * items. Nothing here was ever supplied by a browser.
 */
export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; direction?: string }>;
}) {
  const actor = await requirePermission('bills.view');
  const params = await searchParams;
  const [dict, locale] = await Promise.all([t(), getLocale()]);
  const d = dict.finance.bills.list;
  const statusLabel = (status: string) =>
    dict.finance.bills.status[
      status
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof typeof dict.finance.bills.status
    ] ?? status.toLowerCase().replace('_', ' ');

  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;
  const direction =
    params.direction === 'RECEIVABLE' || params.direction === 'PAYABLE'
      ? params.direction
      : undefined;

  const bills = await db.electronicBill.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(direction ? { direction } : {}),
      ...(params.q
        ? {
            OR: [
              { number: { contains: params.q, mode: 'insensitive' } },
              { client: { nameEn: { contains: params.q, mode: 'insensitive' } } },
              { vendor: { nameEn: { contains: params.q, mode: 'insensitive' } } },
              { project: { code: { contains: params.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      id: true, number: true, direction: true, status: true,
      issuedOn: true, dueOn: true, currency: true,
      total: true, vatAmount: true, whtAmount: true, paidAmount: true,
      client: { select: { id: true, nameEn: true } },
      vendor: { select: { id: true, nameEn: true } },
      project: { select: { id: true, code: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ issuedOn: 'desc' }, { number: 'desc' }],
    take: 200,
  });

  const outstanding = bills.reduce(
    (sum, bill) =>
      ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(bill.status)
        ? sum + Math.max(0, outstandingOf(bill).toNumber())
        : sum,
    0,
  );

  return (
    <Shell active="/bills" domain="finance">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={`${dict.finance.bills.nav.overline} · VAT ${VAT_STANDARD}%`}
          title={dict.finance.bills.nav.title}
          lede={`${d.documentCount(bills.length)}${
            outstanding > 0
              ? ` · ${formatMoney(outstanding, locale, CURRENCY.code)} ${d.outstandingSuffix}`
              : ''
          }`}
          actions={
            can(actor, 'bills.create') ? (
              <a
                href="/bills/new"
                className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Icon name="add" />
                {d.newBill}
              </a>
            ) : undefined
          }
        />

        <form method="get" className="bg-surface rounded-lg border border-line shadow-raised p-4 flex flex-wrap items-end gap-3" role="search">
          <div className="flex-1 min-w-[14rem]">
            <label className="gts-sr" htmlFor="q">
              {d.searchLabel}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-fg-muted">
                <Icon name="search" size={20} />
              </span>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={params.q ?? ''}
                placeholder={d.searchPlaceholder}
                className="w-full h-touch ps-10 pe-3 rounded-sm border border-line bg-surface text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="gts-sr" htmlFor="direction">
              {d.directionLabel}
            </label>
            <select
              id="direction"
              name="direction"
              defaultValue={direction ?? ''}
              className="h-touch px-3 rounded-sm border border-line bg-surface text-sm text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
            >
              <option value="">{d.bothDirections}</option>
              <option value="RECEIVABLE">{d.receivableOption}</option>
              <option value="PAYABLE">{d.payableOption}</option>
            </select>
          </div>
          <div>
            <label className="gts-sr" htmlFor="status">
              {d.statusLabel}
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ''}
              className="h-touch px-3 rounded-sm border border-line bg-surface text-sm text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
            >
              <option value="">{d.anyStatus}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors"
          >
            {d.filter}
          </button>
          {(params.q || status || direction) && (
            <a href="/bills" className="h-touch px-4 inline-flex items-center text-sm font-medium text-fg-secondary hover:text-fg transition-colors">
              {d.clear}
            </a>
          )}
        </form>

        {bills.length === 0 ? (
          <div className="bg-surface rounded-lg border border-line shadow-raised">
            <Empty
              title={params.q || status || direction ? d.noMatchTitle : d.noneYetTitle}
              body={
                params.q || status || direction
                  ? d.noMatchBody
                  : d.noneYetBody
              }
              filtered={Boolean(params.q || status || direction)}
              action={
                can(actor, 'bills.create') && !params.q && !status ? (
                  <a
                    href="/bills/new"
                    className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    <Icon name="add" />
                    {d.newBill}
                  </a>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">
                  {d.table.caption}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{d.table.number}</th>
                    <th scope="col">{d.table.counterparty}</th>
                    <th scope="col">{d.table.project}</th>
                    <th scope="col">{d.table.issued}</th>
                    <th scope="col">{d.table.due}</th>
                    <th scope="col">{d.table.status}</th>
                    <th scope="col" className="gts-cell-num">{d.table.vat} {VAT_STANDARD}%</th>
                    <th scope="col" className="gts-cell-num">{d.table.total}</th>
                    <th scope="col" className="gts-cell-num">{d.table.outstanding}</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const due = outstandingOf(bill);
                    const late = bill.status === 'OVERDUE' ? daysOverdue(bill.dueOn) : 0;
                    const counterparty = bill.client ?? bill.vendor;
                    const href = bill.client
                      ? `/clients/${bill.client.id}`
                      : bill.vendor
                        ? `/vendors/${bill.vendor.id}`
                        : null;

                    return (
                      <tr key={bill.id}>
                        <th scope="row">
                          <a href={`/bills/${bill.id}`} className="gts-cell-link">
                            <bdi>{bill.number}</bdi>
                          </a>
                          <span className="gts-meta gts-cell-sub">
                            {bill.direction === 'RECEIVABLE' ? d.table.receivableTag : d.table.payableTag} ·{' '}
                            {d.table.lineCount(bill._count.items)}
                          </span>
                        </th>
                        <td>
                          {href && counterparty ? (
                            <a href={href} className="gts-cell-link">
                              {counterparty.nameEn}
                            </a>
                          ) : (
                            <span className="gts-meta">—</span>
                          )}
                        </td>
                        <td>
                          {bill.project ? (
                            <a href={`/projects/${bill.project.id}`} className="gts-cell-link">
                              {bill.project.code}
                            </a>
                          ) : (
                            <span className="gts-meta">—</span>
                          )}
                        </td>
                        <td>{formatDate(bill.issuedOn.toISOString(), locale)}</td>
                        <td>
                          {formatDate(bill.dueOn.toISOString(), locale)}
                          {late > 0 && (
                            <span className="gts-meta gts-cell-sub">{d.table.daysLate(late)}</span>
                          )}
                        </td>
                        <td>
                          <Status tone={billTone(bill.status)}>
                            {statusLabel(bill.status)}
                          </Status>
                        </td>
                        <td className="gts-cell-num">
                          <Amount value={bill.vatAmount.toNumber()} size="sm" currency={null} locale={locale} />
                        </td>
                        <td className="gts-cell-num">
                          <Amount value={bill.total.toNumber()} size="sm" currency={null} locale={locale} />
                          {bill.currency !== CURRENCY.code && (
                            <span className="gts-meta gts-cell-sub">{bill.currency}</span>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          {due.lessThanOrEqualTo(0) ? (
                            <span className="gts-meta">
                              {bill.status === 'PAID' ? d.table.settled : '—'}
                            </span>
                          ) : (
                            <Amount value={due.toNumber()} size="sm" currency={null} locale={locale} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}

function billTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'OVERDUE') return 'danger' as const;
  if (status === 'PARTIALLY_PAID' || status === 'PENDING_APPROVAL') return 'warning' as const;
  if (status === 'CANCELLED' || status === 'DRAFT') return 'neutral' as const;
  return 'info' as const;
}
