import type { Metadata } from 'next';

import { Amount, Status, Sparkline } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { PrintPageButton } from '@/components/print-page-button';
import { requirePermission } from '@/lib/auth';
import {
  financialReport, inventoryReport, attendanceReport, projectReport, defaultRange,
} from '@/lib/services/reports';
import { CURRENCY, VAT_STANDARD } from '@/lib/egypt';
import { getLocale } from '@/lib/preferences';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Reports — GTS' };
export const dynamic = 'force-dynamic';

const TABS = ['financial', 'inventory', 'projects', 'attendance'] as const;
type Tab = (typeof TABS)[number];

/**
 * REPORTS.
 *
 * Every aggregate is computed in SQL over the transaction tables. There
 * is no reporting table, so a report cannot fall out of step with the
 * ledger it summarises — and the cost of that is one grouped query per
 * view, which is what a database is for.
 *
 * The date range is in the URL, so a filtered report is a link somebody
 * can send to a colleague or bookmark for next month.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  await requirePermission('reports.view');
  const params = await searchParams;
  const dict = await t();
  const locale = await getLocale();

  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'financial';

  const fallback = defaultRange();
  const range = {
    from: params.from ? new Date(`${params.from}T00:00:00.000Z`) : fallback.from,
    to: params.to ? new Date(`${params.to}T00:00:00.000Z`) : fallback.to,
  };
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  /* Only the active report is queried — the other three would be work
     nobody asked for. */
  const [financial, inventory, projects, attendance] = await Promise.all([
    tab === 'financial' ? financialReport(range) : null,
    tab === 'inventory' ? inventoryReport(range) : null,
    tab === 'projects' ? projectReport() : null,
    tab === 'attendance' ? attendanceReport(range) : null,
  ]);

  const tabHref = (next: Tab) =>
    `/reports?tab=${next}&from=${iso(range.from)}&to=${iso(range.to)}`;

  return (
    <Shell active="/reports" domain="admin">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={dict.overview.reports.system}
          title={dict.overview.reports.title}
          lede={dict.overview.reports.lede}
          actions={<PrintPageButton />}
        />

        <nav className="flex gap-1 border-b border-line" aria-label="Report">
          {TABS.map((name) => (
            <a
              key={name}
              href={tabHref(name)}
              aria-current={tab === name ? 'page' : undefined}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === name
                  ? 'border-brand text-brand-fg'
                  : 'border-transparent text-fg-secondary hover:text-fg'
              }`}
            >
              {dict.overview.reports.tabs[name]}
            </a>
          ))}
        </nav>

        {/* The range does not apply to the project report, which is a
            position rather than a period. */}
        {tab !== 'projects' && (
          <form method="get" className="bg-surface rounded-lg border border-line shadow-raised p-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value={tab} />
            <div>
              <label className="block text-xs font-medium text-fg-secondary mb-1" htmlFor="from">
                {dict.overview.reports.from}
              </label>
              <input id="from" name="from" type="date" defaultValue={iso(range.from)} className="h-touch px-3 rounded-sm border border-line bg-surface text-sm text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-secondary mb-1" htmlFor="to">
                {dict.overview.reports.to}
              </label>
              <input id="to" name="to" type="date" defaultValue={iso(range.to)} className="h-touch px-3 rounded-sm border border-line bg-surface text-sm text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>
            <button
              type="submit"
              className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors"
            >
              {dict.overview.reports.apply}
            </button>
          </form>
        )}

        {/* ---------- Financial ---------- */}
        {financial && (
          <>
            {/*
              Invoiced and cash are shown as SEPARATE groups on purpose.
              They are aged differently — a bill counts in the month it
              was issued, a payment in the month it was received — so an
              invoice raised in May and settled in August appears in one
              group's May and the other's August. Sitting them in one row
              invites the reader to subtract figures that do not describe
              the same transactions.
            */}
            <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
              <h2 className="text-lg font-semibold text-fg mb-4">{dict.overview.reports.invoicedInPeriod}</h2>
              <div className="gts-stat-row">
                <Figure label={dict.overview.reports.billedOut} value={financial.billed.toNumber()} />
                <Figure label={dict.overview.reports.purchased} value={financial.purchased.toNumber()} />
                <Figure
                  label={dict.overview.reports.grossMargin}
                  value={financial.grossMargin.toNumber()}
                  tone={financial.grossMargin.isNegative() ? 'danger' : undefined}
                />
              </div>
              <p className="text-xs text-fg-secondary mt-4">
                {dict.overview.reports.invoicedNote}{' '}
                <strong>{dict.overview.reports.invoicedNoteStrong}</strong> profit, carrying no labour, rent or overhead.
              </p>
            </section>

            <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
              <h2 className="text-lg font-semibold text-fg mb-4">{dict.overview.reports.cashMovedInPeriod}</h2>
              <div className="gts-stat-row">
                <Figure label={dict.overview.reports.collected} value={financial.collected.toNumber()} />
                <Figure label={dict.overview.reports.paidOut} value={financial.paid.toNumber()} />
                <Figure
                  label={dict.overview.reports.netCash}
                  value={financial.collected.minus(financial.paid).toNumber()}
                  tone={financial.collected.minus(financial.paid).isNegative() ? 'warning' : undefined}
                />
              </div>
              <p className="text-xs text-fg-secondary mt-4">
                {dict.overview.reports.cashNote}{' '}
                <em>{dict.overview.reports.cashNoteEm}</em>. They are not comparable with the invoiced figures
                above and should not be subtracted from them.
              </p>
            </section>

            <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
              <h2 className="text-lg font-semibold text-fg mb-4">{`${dict.overview.reports.vatStandardRate} ${VAT_STANDARD}%`}</h2>
              <div className="gts-stat-row">
                <Figure label={dict.overview.reports.vatCharged} value={financial.vatCharged.toNumber()} />
                <Figure label={dict.overview.reports.vatPaidOnPurchases} value={financial.vatPaid.toNumber()} />
                <Figure
                  label={dict.overview.reports.netVatPosition}
                  value={financial.vatPosition.toNumber()}
                  tone={financial.vatPosition.greaterThan(0) ? 'warning' : undefined}
                />
                <Figure label={dict.overview.reports.withheldAtSource} value={financial.withheld.toNumber()} />
              </div>
              <p className="text-xs text-fg-secondary mt-4">
                {dict.overview.reports.vatNote}
              </p>
            </section>

            {financial.byMonth.length > 1 && (
              <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
                <h2 className="text-lg font-semibold text-fg mb-4">{dict.overview.reports.byMonth}</h2>
                <div style={{ color: 'var(--gts-domain-finance)' }}>
                  <Sparkline data={financial.byMonth.map((m) => m.billed)} width={640} height={72} />
                </div>
                <div className="gts-table-scroll mt-4">
                  <table className="gts-table gts-table-compact">
                    <thead>
                      <tr>
                        <th scope="col">{dict.overview.reports.month}</th>
                        <th scope="col" className="gts-cell-num">{dict.overview.reports.billed}</th>
                        <th scope="col" className="gts-cell-num">{dict.overview.reports.collected}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financial.byMonth.map((month) => (
                        <tr key={month.month}>
                          <th scope="row">{month.month}</th>
                          <td className="gts-cell-num">
                            <Amount value={month.billed} size="sm" currency={null} locale={locale} />
                          </td>
                          <td className="gts-cell-num">
                            <Amount value={month.collected} size="sm" currency={null} locale={locale} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* ---------- Inventory ---------- */}
        {inventory && (
          <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <h2 className="text-lg font-semibold text-fg px-6 pt-6 pb-4">{dict.overview.reports.productMovement}</h2>
            {inventory.length === 0 ? (
              <Empty title={dict.overview.reports.noProducts} body={dict.overview.reports.nothingToReport} />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <caption className="gts-sr">
                    {dict.overview.reports.stockMovementCaption}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{dict.overview.reports.product}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.received}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.issued}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.returned}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.damaged}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.adjusted}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.onHandNow}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((row) => (
                      <tr key={row.productId}>
                        <th scope="row">
                          <a href={`/products/${row.productId}`} className="gts-cell-link">
                            {row.nameEn}
                          </a>
                          <span className="gts-meta gts-cell-sub">
                            <bdi>{row.sku}</bdi> · {row.unit}
                          </span>
                        </th>
                        <td className="gts-cell-num">{num(row.received.toNumber())}</td>
                        <td className="gts-cell-num">{num(row.issued.toNumber())}</td>
                        <td className="gts-cell-num">{num(row.returned.toNumber())}</td>
                        <td className="gts-cell-num">
                          {row.damaged.greaterThan(0) ? (
                            <Status tone="warning">{row.damaged.toString()}</Status>
                          ) : (
                            <span className="gts-meta">—</span>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          {row.adjusted.isZero() ? (
                            <span className="gts-meta">—</span>
                          ) : (
                            // A negative adjustment is shrinkage — the
                            // figure worth noticing on this report.
                            <Status tone={row.adjusted.isNegative() ? 'danger' : 'info'}>
                              {row.adjusted.toString()}
                            </Status>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          <strong>{row.onHand.toString()}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---------- Projects ---------- */}
        {projects && (
          <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <h2 className="text-lg font-semibold text-fg px-6 pt-6 pb-4">{dict.overview.reports.projectPosition}</h2>
            {projects.length === 0 ? (
              <Empty title={dict.overview.reports.noProjects} body={dict.overview.reports.nothingToReport} />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">{dict.overview.reports.project}</th>
                      <th scope="col">{dict.overview.reports.status}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.budget}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.billed}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.collected}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.materials}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.damaged}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.days}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <th scope="row">
                          <a href={`/projects/${project.id}`} className="gts-cell-link">
                            {project.nameEn}
                          </a>
                          <span className="gts-meta gts-cell-sub">
                            {project.code} · {project.clientName}
                          </span>
                        </th>
                        <td>
                          <Status tone={project.status === 'ACTIVE' ? 'success' : 'neutral'}>
                            {project.status.toLowerCase().replace('_', ' ')}
                          </Status>
                        </td>
                        <td className="gts-cell-num">
                          {project.budget ? (
                            <>
                              <Amount value={project.budget.toNumber()} size="sm" currency={null} locale={locale} />
                              {project.consumedPct !== null && (
                                <span className="gts-meta gts-cell-sub">
                                  {project.consumedPct}% {dict.overview.reports.percentBilled}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="gts-meta">—</span>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          <Amount value={project.billed.toNumber()} size="sm" currency={null} locale={locale} />
                        </td>
                        <td className="gts-cell-num">
                          <Amount value={project.collected.toNumber()} size="sm" currency={null} locale={locale} />
                        </td>
                        <td className="gts-cell-num">
                          <Amount value={project.materials.toNumber()} size="sm" currency={null} locale={locale} />
                        </td>
                        <td className="gts-cell-num">
                          {project.damaged.greaterThan(0) ? (
                            <Status tone="warning">
                              <Amount value={project.damaged.toNumber()} size="sm" currency={null} locale={locale} />
                            </Status>
                          ) : (
                            <span className="gts-meta">—</span>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          <span className="gts-num gts-num-sm">{project.attendanceDays}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---------- Attendance ---------- */}
        {attendance && (
          <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <h2 className="text-lg font-semibold text-fg px-6 pt-6 pb-4">{dict.overview.reports.attendance}</h2>
            {attendance.length === 0 ? (
              <Empty title={dict.overview.reports.noEmployees} body={dict.overview.reports.nothingToReport} />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <caption className="gts-sr">
                    {dict.overview.reports.attendanceCaption}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{dict.overview.reports.employee}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.daysOnSite}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.late}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.minutesLate}</th>
                      <th scope="col" className="gts-cell-num">{dict.overview.reports.hoursWorked}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((row) => (
                      <tr key={row.employeeId}>
                        <th scope="row">
                          {row.nameEn}
                          <span className="gts-meta gts-cell-sub">
                            {row.code} · {row.jobTitleEn}
                          </span>
                        </th>
                        <td className="gts-cell-num">
                          <span className="gts-num gts-num-sm">{row.days}</span>
                        </td>
                        <td className="gts-cell-num">
                          {row.late > 0 ? (
                            <Status tone="warning">{row.late}</Status>
                          ) : (
                            <span className="gts-meta">—</span>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          {row.minutesLate > 0 ? row.minutesLate : <span className="gts-meta">—</span>}
                        </td>
                        <td className="gts-cell-num">
                          {row.hoursWorked > 0 ? (
                            row.hoursWorked
                          ) : (
                            // Hours need a check-out; a day with only a
                            // check-in is present but not measured.
                            <span className="gts-meta">{dict.overview.reports.notCheckedOut}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </Shell>
  );
}

function num(value: number) {
  return value === 0 ? <span className="gts-meta">—</span> : value.toLocaleString('en-US');
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warning';
}) {
  return (
    <div>
      <p className="text-xs text-fg-muted uppercase tracking-wide">{label}</p>
      <p className={`mt-2 ${tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : ''}`}>
        <Amount value={value} size="md" />
      </p>
    </div>
  );
}
