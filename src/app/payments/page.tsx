import type { Metadata } from 'next';

import { Amount } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

export const metadata: Metadata = { title: 'Payments — GTS' };
export const dynamic = 'force-dynamic';

const DIRECTIONS = ['IN', 'OUT'] as const;

/**
 * PAYMENTS — the cash ledger.
 *
 * Every row is a payment actually received or paid, not an outstanding
 * obligation — that ageing view lives on /accounts. This is what "cash
 * balance" and "collected this month" on the dashboard drill into.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string; from?: string; to?: string }>;
}) {
  await requirePermission('payments.view');
  const params = await searchParams;
  const [dict, locale] = await Promise.all([t(), getLocale()]);
  const d = dict.finance.payments;

  const direction = DIRECTIONS.includes(params.direction as (typeof DIRECTIONS)[number])
    ? (params.direction as (typeof DIRECTIONS)[number])
    : undefined;
  const from = params.from ? new Date(params.from) : undefined;
  const to = params.to ? new Date(params.to) : undefined;

  const payments = await db.payment.findMany({
    where: {
      ...(direction === 'IN' ? { clientId: { not: null } } : {}),
      ...(direction === 'OUT' ? { vendorId: { not: null } } : {}),
      ...(from || to
        ? {
            receivedOn: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true, ref: true, amount: true, method: true, receivedOn: true,
      client: { select: { id: true, nameEn: true } },
      vendor: { select: { id: true, nameEn: true } },
      bill: { select: { id: true, number: true } },
    },
    orderBy: { receivedOn: 'desc' },
    take: 200,
  });

  const total = payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
  const filtered = Boolean(direction || params.from || params.to);

  return (
    <Shell active="/payments" domain="finance">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={d.lede}
        />

        <form method="get" className="bg-surface rounded-lg border border-line shadow-raised p-4 flex flex-wrap items-end gap-3" role="search">
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
              <option value="IN">{d.inOption}</option>
              <option value="OUT">{d.outOption}</option>
            </select>
          </div>
          <div>
            <label className="gts-sr" htmlFor="from">
              {d.fromLabel}
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={params.from ?? ''}
              className="h-touch px-3 rounded-sm border border-line bg-surface text-sm text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="gts-sr" htmlFor="to">
              {d.toLabel}
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={params.to ?? ''}
              className="h-touch px-3 rounded-sm border border-line bg-surface text-sm text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors"
          >
            {d.filter}
          </button>
          {filtered && (
            <a href="/payments" className="h-touch px-4 inline-flex items-center text-sm font-medium text-fg-secondary hover:text-fg transition-colors">
              {d.clear}
            </a>
          )}
          <div className="ms-auto text-end">
            <p className="text-xs text-fg-muted uppercase tracking-wide">{d.total}</p>
            <Amount value={total} size="md" locale={locale} />
          </div>
        </form>

        {payments.length === 0 ? (
          <div className="bg-surface rounded-lg border border-line shadow-raised">
            <Empty
              title={filtered ? d.noMatchTitle : d.noneYetTitle}
              body={filtered ? d.noMatchBody : d.noneYetBody}
              filtered={filtered}
            />
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">{d.table.caption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{d.table.ref}</th>
                    <th scope="col">{d.table.counterparty}</th>
                    <th scope="col">{d.table.againstBill}</th>
                    <th scope="col">{d.table.method}</th>
                    <th scope="col">{d.table.receivedOn}</th>
                    <th scope="col" className="gts-cell-num">{d.table.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const counterparty = p.client ?? p.vendor;
                    const href = p.client ? `/clients/${p.client.id}` : p.vendor ? `/vendors/${p.vendor.id}` : null;

                    return (
                      <tr key={p.id}>
                        <th scope="row">
                          <bdi>{p.ref}</bdi>
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
                          {p.bill ? (
                            <a href={`/bills/${p.bill.id}`} className="gts-cell-link">
                              <bdi>{p.bill.number}</bdi>
                            </a>
                          ) : (
                            <span className="gts-meta">—</span>
                          )}
                        </td>
                        <td>{p.method.toLowerCase().replace('_', ' ')}</td>
                        <td>{formatDate(p.receivedOn.toISOString(), locale)}</td>
                        <td className="gts-cell-num">
                          <Amount value={p.amount.toNumber()} size="sm" currency={null} locale={locale} />
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
