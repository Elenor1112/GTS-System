import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';

import { Amount } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requirePermission } from '@/lib/auth';
import { t, type Dictionary } from '@/lib/i18n';
import { formatDate } from '@/lib/format';
import { getLocale, type Locale } from '@/lib/preferences';
import {
  ledgerTotals, receivablesByClient, payablesByVendor,
  type CounterpartySummary,
} from '@/lib/services/accounts';

export const metadata: Metadata = { title: 'Accounts — GTS' };
export const dynamic = 'force-dynamic';

/**
 * ACCOUNTS — the ageing ladder.
 *
 * Every figure is derived from bill and payment rows at query time.
 * There is no summary table, no nightly rollup and no cached balance,
 * because a stored total that can disagree with the transactions it
 * claims to describe is worse than no total: it is a number people act
 * on that nobody can reconcile.
 *
 * Withholding is subtracted from what is collectable. The buyer remits
 * it to the ETA on our behalf, so treating the gross total as receivable
 * would overstate the ledger on every invoice above the threshold.
 */
export default async function AccountsPage() {
  await requirePermission('accounts.view');

  const [ledger, clients, vendors, dict, locale] = await Promise.all([
    ledgerTotals(),
    receivablesByClient(),
    payablesByVendor(),
    t(),
    getLocale(),
  ]);
  const d = dict.finance.accounts;

  return (
    <Shell active="/accounts" domain="finance">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-8">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={d.lede}
        />

        {/* ---------- The net position ---------- */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-stretch">
          <div className="bg-surface rounded-lg border border-line shadow-raised p-6 flex flex-col justify-center">
            <p className="text-xs text-fg-muted uppercase tracking-wide">{d.netPosition}</p>
            <div className="mt-3">
              <Amount value={ledger.netPosition.toNumber()} size="hero" locale={locale} />
            </div>
            <p className="text-xs text-fg-secondary mt-2">
              {ledger.netPosition.isNegative()
                ? d.netPositionNegative
                : d.netPositionPositive}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Figure
              label={d.receivable}
              value={ledger.receivable.outstanding.toNumber()}
              detail={`${ledger.receivable.openBillCount} ${d.openSuffix}`}
              locale={locale}
            />
            <Figure
              label={d.payable}
              value={ledger.payable.outstanding.toNumber()}
              detail={`${ledger.payable.openBillCount} ${d.openSuffix}`}
              locale={locale}
            />
            <Figure
              label={d.overdueIn}
              value={ledger.receivable.overdue.toNumber()}
              detail={
                ledger.receivable.oldestOverdueDays > 0
                  ? d.oldestDays.replace('{days}', String(ledger.receivable.oldestOverdueDays))
                  : d.nothingLate
              }
              tone={ledger.receivable.overdue.greaterThan(0) ? 'danger' : undefined}
              locale={locale}
            />
            <Figure
              label={d.overdueOut}
              value={ledger.payable.overdue.toNumber()}
              detail={
                ledger.payable.oldestOverdueDays > 0
                  ? d.oldestDays.replace('{days}', String(ledger.payable.oldestOverdueDays))
                  : d.nothingLate
              }
              tone={ledger.payable.overdue.greaterThan(0) ? 'warning' : undefined}
              locale={locale}
            />
          </div>
        </section>

        {/* ---------- Receivables ---------- */}
        <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
          <div className="flex items-center gap-2 px-6 pt-6">
            <Icon name="trending_up" className="text-accent" />
            <h2 className="text-lg font-semibold text-fg">{d.owedToUs} ({clients.length})</h2>
          </div>
          {clients.length === 0 ? (
            <Empty
              title={d.nothingOutstandingTitle}
              body={d.nothingOutstandingReceivableBody}
            />
          ) : (
            <BalanceTable
              rows={clients.map((c) => ({
                id: c.id,
                href: `/clients/${c.id}`,
                name: c.nameEn,
                code: c.code,
                summary: c.summary,
                creditLimit: c.creditLimit.toNumber(),
              }))}
              totals={{
                collected: ledger.receivable.paid,
                outstanding: ledger.receivable.outstanding,
                total: ledger.receivable.billed,
              }}
              dict={dict}
              locale={locale}
            />
          )}
        </section>

        {/* ---------- Payables ---------- */}
        <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
          <div className="flex items-center gap-2 px-6 pt-6">
            <Icon name="trending_down" className="text-warning" />
            <h2 className="text-lg font-semibold text-fg">{d.owedByUs} ({vendors.length})</h2>
          </div>
          {vendors.length === 0 ? (
            <Empty title={d.nothingOutstandingTitle} body={d.nothingOutstandingPayableBody} />
          ) : (
            <BalanceTable
              rows={vendors.map((v) => ({
                id: v.id,
                href: `/vendors/${v.id}`,
                name: v.nameEn,
                code: v.code,
                summary: v.summary,
              }))}
              totals={{
                collected: ledger.payable.paid,
                outstanding: ledger.payable.outstanding,
                total: ledger.payable.billed,
              }}
              dict={dict}
              locale={locale}
            />
          )}
        </section>
      </main>
    </Shell>
  );
}

/**
 * The balance table: what has been collected, what is still outstanding,
 * and the total billed — per counterparty.
 *
 * Ordered worst-first by overdue rather than by size: the collections
 * question is "who is late", not "who is large".
 */
interface BalanceRow {
  id: string;
  href: string;
  name: string;
  code: string;
  creditLimit?: number;
  summary: CounterpartySummary;
}

function BalanceTable({
  rows, totals, dict, locale,
}: {
  rows: BalanceRow[];
  totals: { collected: Prisma.Decimal; outstanding: Prisma.Decimal; total: Prisma.Decimal };
  dict: Dictionary;
  locale: Locale;
}) {
  const d = dict.finance.accounts.table;
  const cell = (value: number) =>
    value === 0 ? (
      <span className="gts-meta">—</span>
    ) : (
      <Amount value={value} size="sm" currency={null} locale={locale} />
    );

  return (
    <div className="gts-table-scroll mt-4">
      <table className="gts-table gts-table-comfortable">
        <caption className="gts-sr">{d.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{d.counterparty}</th>
            <th scope="col" className="gts-cell-num">{d.collected}</th>
            <th scope="col" className="gts-cell-num">{d.outstanding}</th>
            <th scope="col" className="gts-cell-num">{d.total}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <a href={row.href} className="gts-cell-link">
                  {row.name}
                </a>
                <span className="gts-meta gts-cell-sub">
                  {row.code} · {row.summary.openBillCount} {d.openSuffix}
                  {row.summary.oldestOverdueDays > 0 &&
                    ` · ${d.oldestDaysLate.replace('{days}', String(row.summary.oldestOverdueDays))}`}
                  {row.creditLimit !== undefined &&
                    row.creditLimit > 0 &&
                    row.summary.outstanding.toNumber() > row.creditLimit &&
                    ` · ${d.overCreditLimit}`}
                </span>
              </th>
              <td className="gts-cell-num">
                {cell(row.summary.paid.toNumber())}
                {row.summary.lastPaymentOn && (
                  <span className="gts-meta gts-cell-sub block">
                    {d.lastPaymentOn.replace('{date}', formatDate(row.summary.lastPaymentOn.toISOString(), locale))}
                  </span>
                )}
              </td>
              <td className="gts-cell-num">
                {cell(row.summary.outstanding.toNumber())}
                {row.summary.outstanding.greaterThan(0) && row.summary.oldestDueOn && (
                  <span className="gts-meta gts-cell-sub block">
                    {d.dueSince.replace('{date}', formatDate(row.summary.oldestDueOn.toISOString(), locale))}
                  </span>
                )}
              </td>
              <td className="gts-cell-num">{cell(row.summary.billed.toNumber())}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{d.total}</th>
            <td className="gts-cell-num">{cell(totals.collected.toNumber())}</td>
            <td className="gts-cell-num">{cell(totals.outstanding.toNumber())}</td>
            <td className="gts-cell-num">{cell(totals.total.toNumber())}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Figure({
  label,
  value,
  detail,
  tone,
  locale,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'danger' | 'warning';
  locale: Locale;
}) {
  return (
    <div className="bg-surface rounded-lg border border-line shadow-raised p-5">
      <p className="text-xs text-fg-muted uppercase tracking-wide">{label}</p>
      <p className={`mt-2 ${tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : ''}`}>
        <Amount value={value} size="md" locale={locale} />
      </p>
      <p className="text-xs text-fg-secondary mt-1">{detail}</p>
    </div>
  );
}
