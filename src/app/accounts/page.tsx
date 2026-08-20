import type { Metadata } from 'next';

import { Amount, Region, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import {
  ledgerTotals, receivablesByClient, payablesByVendor,
  type CounterpartySummary, type AgeingBuckets,
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

  const [ledger, clients, vendors] = await Promise.all([
    ledgerTotals(),
    receivablesByClient(),
    payablesByVendor(),
  ]);

  return (
    <Shell active="/accounts" domain="finance">
      <main className="gts-page">
        <PageHead
          overline="Financial"
          title="Accounts"
          lede="Receivables and payables, aged from their due dates. Computed from the transactions, never stored."
        />

        {/* ---------- The net position ---------- */}
        <header className="gts-grid-editorial" style={{ alignItems: 'end' }}>
          <div>
            <p className="gts-overline">Net position</p>
            <div style={{ marginBlockStart: 'var(--gts-space-4)' }}>
              <Amount value={ledger.netPosition.toNumber()} size="hero" />
            </div>
            <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-3)' }}>
              {ledger.netPosition.isNegative()
                ? 'More is owed to suppliers than is owed to us.'
                : 'More is owed to us than we owe to suppliers.'}
            </p>
          </div>

          <div className="gts-stat-row">
            <Figure
              label="Receivable"
              value={ledger.receivable.outstanding.toNumber()}
              detail={`${ledger.receivable.openBillCount} open`}
            />
            <Figure
              label="Payable"
              value={ledger.payable.outstanding.toNumber()}
              detail={`${ledger.payable.openBillCount} open`}
            />
            <Figure
              label="Overdue in"
              value={ledger.receivable.overdue.toNumber()}
              detail={
                ledger.receivable.oldestOverdueDays > 0
                  ? `oldest ${ledger.receivable.oldestOverdueDays} days`
                  : 'nothing late'
              }
              tone={ledger.receivable.overdue.greaterThan(0) ? 'danger' : undefined}
            />
            <Figure
              label="Overdue out"
              value={ledger.payable.overdue.toNumber()}
              detail={
                ledger.payable.oldestOverdueDays > 0
                  ? `oldest ${ledger.payable.oldestOverdueDays} days`
                  : 'nothing late'
              }
              tone={ledger.payable.overdue.greaterThan(0) ? 'warning' : undefined}
            />
          </div>
        </header>

        {/* ---------- Receivables ---------- */}
        <Region title={`Owed to us (${clients.length})`}>
          {clients.length === 0 ? (
            <Empty
              title="Nothing outstanding"
              body="Every issued invoice has been settled."
            />
          ) : (
            <AgeingTable
              rows={clients.map((c) => ({
                id: c.id,
                href: `/clients/${c.id}`,
                name: c.nameEn,
                code: c.code,
                summary: c.summary,
                creditLimit: c.creditLimit.toNumber(),
              }))}
              totals={ledger.receivable.ageing}
            />
          )}
        </Region>

        {/* ---------- Payables ---------- */}
        <Region title={`Owed by us (${vendors.length})`}>
          {vendors.length === 0 ? (
            <Empty title="Nothing outstanding" body="Every supplier bill has been settled." />
          ) : (
            <AgeingTable
              rows={vendors.map((v) => ({
                id: v.id,
                href: `/vendors/${v.id}`,
                name: v.nameEn,
                code: v.code,
                summary: v.summary,
              }))}
              totals={ledger.payable.ageing}
            />
          )}
        </Region>
      </main>
    </Shell>
  );
}

/**
 * The ageing ladder, as a table.
 *
 * Ordered worst-first by overdue rather than by size: the collections
 * question is "who is late", not "who is large".
 */
interface AgeingRow {
  id: string;
  href: string;
  name: string;
  code: string;
  creditLimit?: number;
  summary: CounterpartySummary;
}

function AgeingTable({ rows, totals }: { rows: AgeingRow[]; totals: AgeingBuckets }) {
  const cell = (value: number) =>
    value === 0 ? <span className="gts-meta">—</span> : <Amount value={value} size="sm" currency={null} />;

  return (
    <div className="gts-table-scroll">
      <table className="gts-table gts-table-comfortable">
        <caption className="gts-sr">Outstanding balances by age since the due date</caption>
        <thead>
          <tr>
            <th scope="col">Counterparty</th>
            <th scope="col" className="gts-cell-num">Current</th>
            <th scope="col" className="gts-cell-num">1–30</th>
            <th scope="col" className="gts-cell-num">31–60</th>
            <th scope="col" className="gts-cell-num">61–90</th>
            <th scope="col" className="gts-cell-num">90+</th>
            <th scope="col" className="gts-cell-num">Total</th>
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
                  {row.code} · {row.summary.openBillCount} open
                  {row.summary.oldestOverdueDays > 0 &&
                    ` · oldest ${row.summary.oldestOverdueDays} days late`}
                  {row.creditLimit !== undefined &&
                    row.creditLimit > 0 &&
                    row.summary.outstanding.toNumber() > row.creditLimit &&
                    ' · over credit limit'}
                </span>
              </th>
              <td className="gts-cell-num">{cell(row.summary.ageing.current.toNumber())}</td>
              <td className="gts-cell-num">{cell(row.summary.ageing.days1to30.toNumber())}</td>
              <td className="gts-cell-num">{cell(row.summary.ageing.days31to60.toNumber())}</td>
              <td className="gts-cell-num">
                {row.summary.ageing.days61to90.toNumber() > 0 ? (
                  <Status tone="warning">
                    <Amount value={row.summary.ageing.days61to90.toNumber()} size="sm" currency={null} />
                  </Status>
                ) : (
                  <span className="gts-meta">—</span>
                )}
              </td>
              <td className="gts-cell-num">
                {row.summary.ageing.over90.toNumber() > 0 ? (
                  <Status tone="danger">
                    <Amount value={row.summary.ageing.over90.toNumber()} size="sm" currency={null} />
                  </Status>
                ) : (
                  <span className="gts-meta">—</span>
                )}
              </td>
              <td className="gts-cell-num">
                <Amount value={row.summary.outstanding.toNumber()} size="sm" currency={null} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="gts-cell-num">{cell(totals.current.toNumber())}</td>
            <td className="gts-cell-num">{cell(totals.days1to30.toNumber())}</td>
            <td className="gts-cell-num">{cell(totals.days31to60.toNumber())}</td>
            <td className="gts-cell-num">{cell(totals.days61to90.toNumber())}</td>
            <td className="gts-cell-num">{cell(totals.over90.toNumber())}</td>
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
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'danger' | 'warning';
}) {
  return (
    <div className="gts-stat">
      <p className="gts-overline">{label}</p>
      <p className={tone ? `gts-stat-value gts-stat-${tone}` : 'gts-stat-value'}>
        <Amount value={value} size="md" />
      </p>
      <p className="gts-meta">{detail}</p>
    </div>
  );
}
