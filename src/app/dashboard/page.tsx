import type { Metadata } from 'next';

import { Amount, Region, Panel, Status, Chart, Metric } from '@/components/primitives';
import { Shell, Empty } from '@/components/shell';
import { requireActor } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { buildDashboard } from '@/lib/services/dashboard';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/preferences';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Dashboard — GTS' };

/**
 * DASHBOARD — executive command center.
 *
 * Composition, deliberately NOT a KPI wall:
 *
 *   1  Slab       full-bleed opener: ONE hero figure + the receipts plot
 *   2  Band       grid-metrics — the lead cell is 1.6x its siblings
 *   3  Command    8:4 — the operational ocean + the alert rail
 *   4  Duet       storage and attendance, unequal
 *
 * The colour discipline this screen enforces: blue is structure
 * (hero figure, chart series, progress), red is danger and nothing
 * else. A red figure here always means a problem.
 *
 * Every figure comes from `buildDashboard()`, which derives it from the
 * transaction tables. Sections the actor cannot see are absent, not
 * zeroed: an employee without accounts access sees no financial panel
 * rather than a row of zeroes implying the company holds nothing.
 */

/** Dashboards must never be cached across users — the content is
 *  permission-dependent and changes with every posted transaction. */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const actor = await requireActor();
  const data = await buildDashboard(actor);
  const dict = await t();
  const locale = await getLocale();

  const seesMoney = can(actor, 'accounts.view');
  const firstName = actor.nameEn.split(' ')[0];
  const hasReceipts = data.receiptsSeries.some((r) => r.value > 0);

  return (
    <Shell active="/dashboard" domain="finance">
      <main className="gts-page">
        {/* ---------- 1 · SLAB OPENER ------------------------
            Full-bleed accent wash with a 2px brand rule on top.
            One hero figure; a second would mean the hierarchy failed. */}
        <header className="gts-slab gts-slab-accent">
          <div className="gts-grid-editorial" style={{ alignItems: 'end' }}>
            <div>
              <p className="gts-overline">
                {seesMoney ? dict.overview.dashboard.netPosition : dict.overview.dashboard.yourWorkspace} ·{' '}
                {formatDate(new Date().toISOString(), locale)}
              </p>
              <h1
                className="gts-page-title"
                style={{ marginBlockStart: 'var(--gts-space-2)' }}
              >
                {dict.overview.dashboard.goodMorning}, {firstName}
              </h1>

              {seesMoney ? (
                <>
                  <div style={{ marginBlockStart: 'var(--gts-space-6)' }}>
                    <Amount value={data.netPosition.toNumber()} size="hero" locale={locale} />
                  </div>
                  <p
                    className="gts-meta"
                    style={{
                      marginBlockStart: 'var(--gts-space-3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--gts-space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      {dict.overview.dashboard.receivable}{' '}
                      <Amount value={data.receivable.toNumber()} size="sm" currency={null} locale={locale} />
                    </span>
                    <span aria-hidden="true" style={{ opacity: 0.5 }}>
                      ·
                    </span>
                    <span>
                      {dict.overview.dashboard.payable} <Amount value={data.payable.toNumber()} size="sm" currency={null} locale={locale} />
                    </span>
                    {data.overdueReceivable.greaterThan(0) && (
                      <>
                        <span aria-hidden="true" style={{ opacity: 0.5 }}>
                          ·
                        </span>
                        <Status tone="danger">
                          <Amount
                            value={data.overdueReceivable.toNumber()}
                            size="sm"
                            currency={null}
                            locale={locale}
                          />{' '}
                          {dict.overview.dashboard.overdue}
                        </Status>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p
                  style={{
                    font: 'var(--gts-role-body)',
                    color: 'var(--gts-fg-secondary)',
                    maxInlineSize: 'var(--gts-prose-max)',
                    marginBlockStart: 'var(--gts-space-4)',
                  }}
                >
                  {data.counts.activeProjects}{' '}
                  {data.counts.activeProjects === 1
                    ? dict.overview.dashboard.activeProjectsSummary
                    : dict.overview.dashboard.activeProjectsSummaryPlural}
                  . {dict.overview.dashboard.railHint}
                </p>
              )}
            </div>

            {seesMoney && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--gts-space-3)',
                }}
              >
                {hasReceipts ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 'var(--gts-space-4)',
                      }}
                    >
                      <span className="gts-overline">{dict.overview.dashboard.receiptsTwelveMonths}</span>
                      <span className="gts-meta">
                        <Amount
                          value={data.collectedThisMonth.toNumber()}
                          size="sm"
                          currency={null}
                          locale={locale}
                        />{' '}
                        {dict.overview.dashboard.thisMonth}
                      </span>
                    </div>
                    <Chart data={data.receiptsSeries} />
                  </>
                ) : (
                  <p className="gts-meta">
                    {dict.overview.dashboard.noReceiptsYet}
                  </p>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ---------- 2 · METRIC BAND ------------------------
            Not four equal KPIs: the lead cell is 1.6x its siblings. */}
        {seesMoney && (
          <div className="gts-grid-metrics">
            <Metric label={dict.overview.dashboard.billedThisMonth} value={data.billedThisMonth.toNumber()} lead />
            <Metric label={dict.overview.dashboard.collected} value={data.collectedThisMonth.toNumber()} />
            <Metric label={dict.overview.dashboard.outstanding} value={data.receivable.toNumber()} />
            <Metric
              label={dict.overview.dashboard.overdue}
              value={data.overdueReceivable.toNumber()}
              tone={data.overdueReceivable.greaterThan(0) ? 'danger' : undefined}
            />
          </div>
        )}

        {/* ---------- 3 · COMMAND — the ocean + the signal rail ---------- */}
        <div className="gts-grid-command">
          {can(actor, 'projects.view') ? (
            <Region
              title={dict.overview.dashboard.activeProjects}
              action={
                <a href="/projects" className="gts-btn gts-btn-ghost gts-btn-xs">
                  {dict.overview.dashboard.allProjects}
                </a>
              }
            >
              {data.projects.length === 0 ? (
                <Empty title={dict.overview.dashboard.noActiveProjects} body={dict.overview.dashboard.createProjectHint} />
              ) : (
                <ul className="gts-list">
                  {data.projects.map((p) => {
                    const over = p.consumedPct !== null && p.consumedPct > 100;
                    return (
                      <li key={p.id} className="gts-list-row">
                        <div style={{ minInlineSize: 0 }}>
                          <a href={`/projects/${p.id}`} className="gts-list-title">
                            {p.nameEn}
                          </a>
                          <p className="gts-meta">
                            {p.code} · {p.clientName}
                          </p>
                        </div>
                        {p.consumedPct !== null ? (
                          <div className="gts-list-figure">
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                justifyContent: 'space-between',
                                inlineSize: '100%',
                                gap: 'var(--gts-space-2)',
                              }}
                            >
                              <span className="gts-meta">{dict.overview.dashboard.budgetBilled}</span>
                              <span
                                className="gts-num gts-num-sm"
                                style={over ? { color: 'var(--gts-danger-fg)' } : undefined}
                              >
                                {p.consumedPct}%
                              </span>
                            </div>
                            <div
                              className="gts-progress"
                              role="img"
                              aria-label={`${p.consumedPct}% of budget billed`}
                            >
                              <div
                                className="gts-progress-bar"
                                style={{
                                  inlineSize: `${Math.min(100, p.consumedPct)}%`,
                                  ...(over ? { background: 'var(--gts-danger-fg)' } : null),
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="gts-meta">{dict.overview.dashboard.noBudgetSet}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Region>
          ) : (
            <div />
          )}

          <Region
            title={dict.overview.dashboard.needsAttention}
            action={
              data.alerts.length > 0 ? (
                <span className="gts-num gts-num-sm" style={{ color: 'var(--gts-fg-muted)' }}>
                  {data.alerts.length}
                </span>
              ) : undefined
            }
          >
            {data.alerts.length === 0 ? (
              <Empty
                title={dict.overview.dashboard.nothingNeedsYou}
                body={dict.overview.dashboard.nothingNeedsYouBody}
              />
            ) : (
              <ul className="gts-alert-list">
                {data.alerts.map((alert) => (
                  <li key={alert.id} className="gts-alert" data-tone={alert.tone}>
                    <div style={{ minInlineSize: 0 }}>
                      <p className="gts-alert-title">{alert.title}</p>
                      <p className="gts-alert-detail">{alert.detail}</p>
                    </div>
                    <a href={alert.href} className="gts-btn gts-btn-secondary gts-btn-sm">
                      {alert.action}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Region>
        </div>

        {/* ---------- 4 · DUET — storage and attendance, unequal ---------- */}
        {(can(actor, 'inventory.view') || can(actor, 'attendance.view')) && (
          <div className="gts-grid-editorial">
            {can(actor, 'inventory.view') && (
              <Panel
                title={dict.overview.dashboard.storage}
                action={
                  <a href="/storage" className="gts-btn gts-btn-ghost gts-btn-xs">
                    {dict.overview.dashboard.all}
                  </a>
                }
              >
                {data.warehouses.length === 0 ? (
                  <Empty title={dict.overview.dashboard.noWarehouses} body={dict.overview.dashboard.createWarehouseHint} />
                ) : (
                  <ul className="gts-list">
                    {data.warehouses.map((w) => (
                      <li key={w.id} className="gts-list-row">
                        <div style={{ minInlineSize: 0 }}>
                          <a href={`/storage/${w.id}`} className="gts-list-title">
                            {w.nameEn}
                          </a>
                          <p className="gts-meta">
                            {w.distinctProducts}{' '}
                            {w.distinctProducts === 1
                              ? dict.overview.dashboard.productInStock
                              : dict.overview.dashboard.productsInStock}
                          </p>
                        </div>
                        <span className="gts-num gts-num-sm">{w.totalUnits.toString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {can(actor, 'attendance.view') && (
              <Panel
                title={dict.overview.dashboard.onSiteToday}
                action={
                  <a href="/attendance" className="gts-btn gts-btn-ghost gts-btn-xs">
                    {dict.overview.dashboard.all}
                  </a>
                }
              >
                {data.attendanceToday.expected === 0 ? (
                  <Empty
                    title={dict.overview.dashboard.nobodyAssigned}
                    body={dict.overview.dashboard.nobodyAssignedBody}
                  />
                ) : data.attendanceToday.isWeekend ? (
                  // Friday and Saturday are the Egyptian weekend. An
                  // empty site is the expected state, not a problem.
                  <Empty
                    title={dict.overview.dashboard.weekend}
                    body={dict.overview.dashboard.weekendBody}
                  />
                ) : (
                  <>
                    <div className="gts-stat-row">
                      <Stat label={dict.overview.dashboard.present} value={data.attendanceToday.present} />
                      <Stat label={dict.overview.dashboard.late} value={data.attendanceToday.late} tone="warning" />
                      <Stat
                        label={dict.overview.dashboard.notIn}
                        value={data.attendanceToday.missing}
                        /*
                         * Red only once the working day has actually
                         * started. Nobody having checked in at 06:00 is
                         * not a problem; the same figure at 14:00 is.
                         * Colouring it red every morning would train
                         * people to ignore the one morning it matters.
                         */
                        tone={
                          data.attendanceToday.missing > 0 &&
                          !data.attendanceToday.beforeWorkStart
                            ? 'danger'
                            : undefined
                        }
                      />
                    </div>
                    {/* The ratio is the fact, not the three numbers. */}
                    <div
                      className="gts-splitbar"
                      style={{ marginBlockStart: 'var(--gts-space-4)' }}
                      role="img"
                      aria-label={`${data.attendanceToday.present} present, ${data.attendanceToday.late} late, ${data.attendanceToday.missing} not in`}
                    >
                      {data.attendanceToday.present > 0 && (
                        <div
                          style={{
                            flex: data.attendanceToday.present,
                            background: 'var(--gts-domain-attendance)',
                          }}
                        />
                      )}
                      {data.attendanceToday.late > 0 && (
                        <div
                          style={{
                            flex: data.attendanceToday.late,
                            background: 'var(--gts-warning-50)',
                          }}
                        />
                      )}
                      {data.attendanceToday.missing > 0 && (
                        <div
                          style={{
                            flex: data.attendanceToday.missing,
                            background: data.attendanceToday.beforeWorkStart
                              ? 'var(--gts-border-default)'
                              : 'var(--gts-danger-50)',
                          }}
                        />
                      )}
                    </div>
                    <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-3)' }}>
                      {data.attendanceToday.expected} {dict.overview.dashboard.expectedOnSite}
                      {data.attendanceToday.beforeWorkStart &&
                        data.attendanceToday.missing > 0 &&
                        ` · ${dict.overview.dashboard.workingDayNotStarted}`}
                    </p>
                  </>
                )}
              </Panel>
            )}
          </div>
        )}
      </main>
    </Shell>
  );
}

/** A labelled plain integer. Money uses <Metric> in the band instead. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warning';
}) {
  return (
    <div className="gts-stat">
      <p className="gts-overline">{label}</p>
      <p className={tone ? `gts-stat-value gts-stat-${tone}` : 'gts-stat-value'}>
        <span className="gts-num gts-num-md">{value}</span>
      </p>
    </div>
  );
}
