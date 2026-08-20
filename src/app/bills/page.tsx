import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { outstandingOf } from '@/lib/services/billing';
import { daysOverdue } from '@/lib/services/accounts';
import { formatDate } from '@/lib/format';
import { CURRENCY, VAT_STANDARD } from '@/lib/egypt';

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
      <main className="gts-page">
        <PageHead
          overline={`Tax documents · VAT ${VAT_STANDARD}%`}
          title="Electronic bills"
          lede={`${bills.length} document${bills.length === 1 ? '' : 's'}${
            outstanding > 0
              ? ` · ${CURRENCY.code} ${outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })} outstanding`
              : ''
          }`}
          actions={
            can(actor, 'bills.create') ? (
              <a href="/bills/new" className="gts-btn gts-btn-accent">
                New bill
              </a>
            ) : undefined
          }
        />

        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 14rem' }}>
            <label className="gts-sr" htmlFor="q">
              Search bills
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Number, counterparty or project"
              className="gts-input"
            />
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="direction">
              Direction
            </label>
            <select
              id="direction"
              name="direction"
              defaultValue={direction ?? ''}
              className="gts-input gts-select"
            >
              <option value="">Both directions</option>
              <option value="RECEIVABLE">Receivable — issued to clients</option>
              <option value="PAYABLE">Payable — received from vendors</option>
            </select>
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ''}
              className="gts-input gts-select"
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase().replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="gts-btn gts-btn-secondary">
            Filter
          </button>
          {(params.q || status || direction) && (
            <a href="/bills" className="gts-btn gts-btn-ghost">
              Clear
            </a>
          )}
        </form>

        {bills.length === 0 ? (
          <Empty
            title={params.q || status || direction ? 'No bill matches' : 'No bills yet'}
            body={
              params.q || status || direction
                ? 'Try a different filter, or clear it to see everything.'
                : 'A bill carries line items, and every total on it is computed from those lines on the server.'
            }
            filtered={Boolean(params.q || status || direction)}
            action={
              can(actor, 'bills.create') && !params.q && !status ? (
                <a href="/bills/new" className="gts-btn gts-btn-accent">
                  New bill
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">
                Electronic bills, with VAT and outstanding balances
              </caption>
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Counterparty</th>
                  <th scope="col">Project</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Due</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="gts-cell-num">VAT {VAT_STANDARD}%</th>
                  <th scope="col" className="gts-cell-num">Total</th>
                  <th scope="col" className="gts-cell-num">Outstanding</th>
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
                          {bill.direction === 'RECEIVABLE' ? 'receivable' : 'payable'} ·{' '}
                          {bill._count.items} line{bill._count.items === 1 ? '' : 's'}
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
                      <td>{formatDate(bill.issuedOn.toISOString())}</td>
                      <td>
                        {formatDate(bill.dueOn.toISOString())}
                        {late > 0 && (
                          <span className="gts-meta gts-cell-sub">{late} days late</span>
                        )}
                      </td>
                      <td>
                        <Status tone={billTone(bill.status)}>
                          {bill.status.toLowerCase().replace('_', ' ')}
                        </Status>
                      </td>
                      <td className="gts-cell-num">
                        <Amount value={bill.vatAmount.toNumber()} size="sm" currency={null} />
                      </td>
                      <td className="gts-cell-num">
                        <Amount value={bill.total.toNumber()} size="sm" currency={null} />
                        {bill.currency !== CURRENCY.code && (
                          <span className="gts-meta gts-cell-sub">{bill.currency}</span>
                        )}
                      </td>
                      <td className="gts-cell-num">
                        {due.lessThanOrEqualTo(0) ? (
                          <span className="gts-meta">
                            {bill.status === 'PAID' ? 'settled' : '—'}
                          </span>
                        ) : (
                          <Amount value={due.toNumber()} size="sm" currency={null} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
