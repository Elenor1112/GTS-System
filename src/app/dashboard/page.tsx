import type { Metadata } from 'next';

import { Amount, Region, Panel, Status, Chart, Metric } from '@/components/primitives';
import { Shell, Empty } from '@/components/shell';
import { requireActor } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { buildDashboard } from '@/lib/services/dashboard';
import { formatDate } from '@/lib/format';

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
                {seesMoney ? 'Net position' : 'Your workspace'} ·{' '}
                {formatDate(new Date().toISOString())}
              </p>
              <h1
                className="gts-page-title"
                style={{ marginBlockStart: 'var(--gts-space-2)' }}
              >
                Good morning, {firstName}
              </h1>

              {seesMoney ? (
                <>
                  <div style={{ marginBlockStart: 'var(--gts-space-6)' }}>
                    <Amount value={data.netPosition.toNumber()} size="hero" />
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
                      Receivable{' '}
                      <Amount value={data.receivable.toNumber()} size="sm" currency={null} />
                    </span>
                    <span aria-hidden="true" style={{ opacity: 0.5 }}>
                      ·
                    </span>
                    <span>
                      payable <Amount value={data.payable.toNumber()} size="sm" currency={null} />
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
                          />{' '}
                          overdue
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
                  {data.counts.activeProjects} active project
                  {data.counts.activeProjects === 1 ? '' : 's'}. Your assigned sites and leave are
                  in the rail.
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
                      <span className="gts-overline">Receipts · 12 months</span>
                      <span className="gts-meta">
                        <Amount
                          value={data.collectedThisMonth.toNumber()}
                          size="sm"
                          currency={null}
                        />{' '}
                        this month
                      </span>
                    </div>
                    <Chart data={data.receiptsSeries} />
                  </>
                ) : (
                  <p className="gts-meta">
                    No payments recorded yet. The receipts trend appears once money starts
                    arriving.
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
            <Metric label="Billed this month" value={data.billedThisMonth.toNumber()} lead />
            <Metric label="Collected" value={data.collectedThisMonth.toNumber()} />
            <Metric label="Outstanding" value={data.receivable.toNumber()} />
            <Metric
              label="Overdue"
              value={data.overdueReceivable.toNumber()}
              tone={data.overdueReceivable.greaterThan(0) ? 'danger' : undefined}
            />
          </div>
        )}

        {/* ---------- 3 · COMMAND — the ocean + the signal rail ---------- */}
        <div className="gts-grid-command">
          {can(actor, 'projects.view') ? (
            <Region
              title="Active projects"
              action={
                <a href="/projects" className="gts-btn gts-btn-ghost gts-btn-xs">
                  All projects
                </a>
              }
            >
              {data.projects.length === 0 ? (
                <Empty title="No active projects" body="Create one to begin tracking work." />
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
                              <span className="gts-meta">budget billed</span>
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
                          <span className="gts-meta">No budget set</span>
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
            title="Needs attention"
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
                title="Nothing needs you"
                body="No overdue bills, no low stock, nothing waiting on your approval."
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
                title="Storage"
                action={
                  <a href="/storage" className="gts-btn gts-btn-ghost gts-btn-xs">
                    All
                  </a>
                }
              >
                {data.warehouses.length === 0 ? (
                  <Empty title="No warehouses" body="Create one to start receiving stock." />
                ) : (
                  <ul className="gts-list">
                    {data.warehouses.map((w) => (
                      <li key={w.id} className="gts-list-row">
                        <div style={{ minInlineSize: 0 }}>
                          <a href={`/storage/${w.id}`} className="gts-list-title">
                            {w.nameEn}
                          </a>
                          <p className="gts-meta">
                            {w.distinctProducts} product{w.distinctProducts === 1 ? '' : 's'} in
                            stock
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
                title="On site today"
                action={
                  <a href="/attendance" className="gts-btn gts-btn-ghost gts-btn-xs">
                    All
                  </a>
                }
              >
                {data.attendanceToday.expected === 0 ? (
                  <Empty
                    title="Nobody assigned"
                    body="Assign employees to an active project to track attendance."
                  />
                ) : data.attendanceToday.isWeekend ? (
                  // Friday and Saturday are the Egyptian weekend. An
                  // empty site is the expected state, not a problem.
                  <Empty
                    title="Weekend"
                    body="Friday and Saturday are the rest days. Attendance resumes on Sunday."
                  />
                ) : (
                  <>
                    <div className="gts-stat-row">
                      <Stat label="Present" value={data.attendanceToday.present} />
                      <Stat label="Late" value={data.attendanceToday.late} tone="warning" />
                      <Stat
                        label="Not in"
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
                      {data.attendanceToday.expected} expected on site today
                      {data.attendanceToday.beforeWorkStart &&
                        data.attendanceToday.missing > 0 &&
                        ' · the working day has not started yet'}
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
