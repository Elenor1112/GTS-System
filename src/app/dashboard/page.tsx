import type { Metadata } from 'next';

import { Shell, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requireActor } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { buildDashboard, type DashboardAlert } from '@/lib/services/dashboard';
import { formatDate, splitAmount } from '@/lib/format';
import { getLocale } from '@/lib/preferences';
import { t } from '@/lib/i18n';
import { CURRENCY } from '@/lib/egypt';

export const metadata: Metadata = { title: 'Dashboard — GTS' };

/**
 * DASHBOARD — Executive Command Centre, matching the Stitch
 * "Dashboard - Executive Command Centre" screen: a welcome banner,
 * a 4-up metrics bento row, quick actions, a cash-flow chart, and a
 * recent-activity rail.
 *
 * All figures come from `buildDashboard()`, unchanged — this file
 * only decides how they are shown.
 */

export const dynamic = 'force-dynamic';

const LEAD_ALERT_COUNT = 3;

/** Word-based severity, mapped from the alert's existing tone. */
function severityOf(alert: DashboardAlert): 'high' | 'medium' | 'low' {
  if (alert.tone === 'danger') return 'high';
  if (alert.tone === 'warning') return 'medium';
  return 'low';
}

function severityIcon(alert: DashboardAlert) {
  if (alert.tone === 'danger') return 'receipt_long';
  if (alert.tone === 'warning') return 'inventory_2';
  return 'notifications';
}

function money(value: number, locale: 'en' | 'ar') {
  const { negative, integer, fraction, decimal } = splitAmount(value, locale);
  return (
    <>
      <span className="text-base align-top opacity-70 me-1">{CURRENCY.mark}</span>
      {negative ? '−' : ''}
      {integer}
      <span className="opacity-55">
        {decimal}
        {fraction}
      </span>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
  trend,
  tone,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  trend?: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <div className="bg-surface rounded-lg p-6 border border-line shadow-raised flex flex-col hover:bg-hover transition-colors">
      <div className="flex items-center gap-2 text-fg-secondary mb-4">
        <Icon name={icon} className={tone === 'danger' ? 'text-danger' : 'text-accent'} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-semibold mb-1 ${tone === 'danger' ? 'text-danger' : 'text-brand-fg'}`}>
        {value}
      </div>
      {trend && <div className="text-xs text-fg-secondary flex items-center gap-1">{trend}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const actor = await requireActor();
  const data = await buildDashboard(actor);
  const dict = await t();
  const locale = await getLocale();

  const seesMoney = can(actor, 'accounts.view');
  const firstName = actor.nameEn.split(' ')[0];
  const leadAlerts = data.alerts.slice(0, LEAD_ALERT_COUNT);
  const restAlertsCount = data.alerts.length - leadAlerts.length;

  return (
    <Shell active="/dashboard" domain="finance">
      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8">
        {/* ---------- WELCOME BANNER ---------- */}
        <section className="bg-surface rounded-lg p-8 border border-line shadow-raised relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs text-fg-muted mb-1">{formatDate(new Date().toISOString(), locale)}</p>
            <h1 className="text-4xl font-bold text-brand-fg mb-2">
              {dict.overview.dashboard.goodMorning}, {firstName}.
            </h1>
          </div>
          <div className="absolute top-0 end-0 w-64 h-full bg-accent opacity-10 blur-3xl pointer-events-none" aria-hidden="true" />
        </section>

        {/* ---------- NEEDS ATTENTION ---------- */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold text-fg">{dict.overview.dashboard.needsAttention}</h2>
            {data.alerts.length > 0 && (
              <span className="min-w-5 px-1.5 h-5 rounded-full bg-danger text-fg-on-accent text-2xs font-semibold inline-flex items-center justify-center">
                {data.alerts.length}
              </span>
            )}
          </div>

          {data.alerts.length === 0 ? (
            <p className="text-sm text-fg-secondary bg-surface rounded-lg p-6 border border-line">
              <strong className="text-fg">{dict.overview.dashboard.nothingNeedsYouTitle}</strong>{' '}
              {dict.overview.dashboard.nothingNeedsYouBody}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {leadAlerts.map((alert) => {
                  const severity = severityOf(alert);
                  return (
                    <li
                      key={alert.id}
                      data-severity={severity}
                      className="flex items-center gap-4 bg-surface rounded-lg p-4 border border-line shadow-raised"
                    >
                      <Icon
                        name={severityIcon(alert)}
                        className={
                          severity === 'high' ? 'text-danger' : severity === 'medium' ? 'text-warning' : 'text-info'
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg truncate">{alert.title}</p>
                        <p className="text-xs text-fg-secondary truncate">{alert.detail}</p>
                      </div>
                      <a
                        href={alert.href}
                        className="shrink-0 h-9 px-4 rounded-sm border border-line text-brand-fg text-sm font-medium flex items-center hover:bg-hover transition-colors"
                      >
                        {alert.action}
                      </a>
                    </li>
                  );
                })}
              </ul>
              {restAlertsCount > 0 && (
                <a
                  href="/notifications"
                  className="inline-block mt-3 text-sm font-medium text-brand-fg hover:underline"
                >
                  {dict.overview.dashboard.seeMore.replace('{count}', String(restAlertsCount))}
                </a>
              )}
            </>
          )}
        </section>

        {/* ---------- KEY METRICS ---------- */}
        {seesMoney ? (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard
              icon="account_balance"
              label={dict.overview.dashboard.yourNetPosition}
              value={money(data.netPosition.toNumber(), locale)}
              tone={data.netPosition.toNumber() < 0 ? 'danger' : undefined}
            />
            <MetricCard
              icon="account_balance_wallet"
              label={dict.overview.dashboard.cashBalance}
              value={money(data.cashBalance.toNumber(), locale)}
              tone={data.cashBalance.toNumber() < 0 ? 'danger' : undefined}
            />
            <MetricCard
              icon="payments"
              label={dict.overview.dashboard.collectedThisMonth}
              value={money(data.collectedThisMonth.toNumber(), locale)}
            />
            <MetricCard
              icon="arrow_downward"
              label={dict.overview.dashboard.receivable}
              value={money(data.receivable.toNumber(), locale)}
              trend={
                data.overdueReceivable.greaterThan(0) ? (
                  <span className="text-danger">
                    {CURRENCY.mark} {splitAmount(data.overdueReceivable.toNumber(), locale).integer}{' '}
                    {dict.overview.dashboard.isOverdue}
                  </span>
                ) : undefined
              }
            />
            <MetricCard
              icon="arrow_upward"
              label={dict.overview.dashboard.payable}
              value={money(data.payable.toNumber(), locale)}
            />
          </section>
        ) : (
          <section>
            <p className="text-sm text-fg-secondary">
              {data.counts.activeProjects}{' '}
              {data.counts.activeProjects === 1
                ? dict.overview.dashboard.activeProjectsSummary
                : dict.overview.dashboard.activeProjectsSummaryPlural}
              . {dict.overview.dashboard.railHint}
            </p>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ---------- YOUR WORK ---------- */}
          <div className="lg:col-span-2 space-y-8">
            {can(actor, 'projects.view') && (
              <section className="bg-surface rounded-lg p-6 border border-line shadow-raised">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-fg">{dict.overview.dashboard.yourWork}</h3>
                  <a href="/projects" className="text-sm font-medium text-brand-fg hover:underline">
                    {dict.overview.dashboard.allProjects}
                  </a>
                </div>

                {data.projects.length === 0 ? (
                  <Empty
                    title={dict.overview.dashboard.noActiveProjects}
                    body={dict.overview.dashboard.createProjectHint}
                  />
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {data.projects.slice(0, 5).map((p) => {
                      const over = p.consumedPct !== null && p.consumedPct > 100;
                      return (
                        <li key={p.id}>
                          <a href={`/projects/${p.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-hover -mx-2 px-2 rounded-sm transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-fg truncate">{p.nameEn}</p>
                              <p className="text-xs text-fg-secondary truncate">{p.clientName}</p>
                            </div>
                            {p.consumedPct !== null ? (
                              <div className="shrink-0 flex flex-col items-end gap-1.5 w-32">
                                <div className="w-full h-1.5 rounded-full bg-inset overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-accent'}`}
                                    style={{ width: `${Math.min(100, p.consumedPct)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-fg-secondary">
                                  {p.consumedPct}% {dict.overview.dashboard.percentBilledSuffix}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-fg-muted shrink-0">{dict.overview.dashboard.noBudgetSetShort}</span>
                            )}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* ---------- STORAGE / ATTENDANCE ---------- */}
            {(can(actor, 'inventory.view') || can(actor, 'attendance.view')) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {can(actor, 'inventory.view') && (
                  <section className="bg-surface rounded-lg p-6 border border-line shadow-raised">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-fg uppercase tracking-wide">{dict.overview.dashboard.storage}</h3>
                      <a href="/storage" className="text-xs font-medium text-brand-fg hover:underline">
                        {dict.overview.dashboard.all}
                      </a>
                    </div>
                    {data.warehouses.length === 0 ? (
                      <Empty
                        title={dict.overview.dashboard.noWarehouses}
                        body={dict.overview.dashboard.createWarehouseHint}
                      />
                    ) : (
                      <ul className="flex flex-col divide-y divide-line">
                        {data.warehouses.map((w) => (
                          <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <a href={`/storage/${w.id}`} className="text-sm font-medium text-fg hover:text-brand-fg truncate block">
                                {w.nameEn}
                              </a>
                              <p className="text-xs text-fg-secondary truncate">
                                {w.distinctProducts}{' '}
                                {w.distinctProducts === 1
                                  ? dict.overview.dashboard.productInStock
                                  : dict.overview.dashboard.productsInStock}
                              </p>
                            </div>
                            <span className="text-sm font-medium text-fg shrink-0">{w.totalUnits.toString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                {can(actor, 'attendance.view') && (
                  <section className="bg-surface rounded-lg p-6 border border-line shadow-raised">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-fg uppercase tracking-wide">{dict.overview.dashboard.onSiteToday}</h3>
                      <a href="/attendance" className="text-xs font-medium text-brand-fg hover:underline">
                        {dict.overview.dashboard.all}
                      </a>
                    </div>
                    {data.attendanceToday.expected === 0 ? (
                      <Empty title={dict.overview.dashboard.nobodyAssigned} body={dict.overview.dashboard.nobodyAssignedBody} />
                    ) : data.attendanceToday.isWeekend ? (
                      <Empty title={dict.overview.dashboard.weekend} body={dict.overview.dashboard.weekendBody} />
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-fg-muted mb-1">{dict.overview.dashboard.present}</p>
                            <p className="text-2xl font-semibold text-fg">{data.attendanceToday.present}</p>
                          </div>
                          <div>
                            <p className="text-xs text-fg-muted mb-1">{dict.overview.dashboard.late}</p>
                            <p className="text-2xl font-semibold text-fg">{data.attendanceToday.late}</p>
                          </div>
                          <div>
                            <p className="text-xs text-fg-muted mb-1">{dict.overview.dashboard.notInYet}</p>
                            <p
                              className={`text-2xl font-semibold ${
                                data.attendanceToday.missing > 0 && !data.attendanceToday.beforeWorkStart
                                  ? 'text-danger'
                                  : 'text-fg'
                              }`}
                            >
                              {data.attendanceToday.missing}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-fg-secondary mt-4">
                          {data.attendanceToday.expected} {dict.overview.dashboard.peopleExpected}
                          {data.attendanceToday.beforeWorkStart &&
                            data.attendanceToday.missing > 0 &&
                            ` — ${dict.overview.dashboard.workingDayNotStarted}`}
                        </p>
                      </>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>

          {/* ---------- QUICK ACTIONS + RECENT ACTIVITY RAIL ---------- */}
          <div className="lg:col-span-1 space-y-8">
            <section className="bg-surface rounded-lg p-6 border border-line shadow-raised">
              <h3 className="text-lg font-semibold text-fg mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-3">
                <a
                  href="/bills/new"
                  className="flex items-center gap-3 p-4 rounded-sm bg-inset hover:bg-hover transition-colors border border-line"
                >
                  <span className="w-10 h-10 rounded-full bg-brand text-fg-on-accent flex items-center justify-center shrink-0">
                    <Icon name="add_circle" filled />
                  </span>
                  <span className="text-sm font-medium text-fg">Create New Bill</span>
                </a>
                <a
                  href="/attendance"
                  className="flex items-center gap-3 p-4 rounded-sm bg-inset hover:bg-hover transition-colors border border-line"
                >
                  <span className="w-10 h-10 rounded-full bg-accent text-fg-on-accent flex items-center justify-center shrink-0">
                    <Icon name="how_to_reg" filled />
                  </span>
                  <span className="text-sm font-medium text-fg">Check-in Attendance</span>
                </a>
                <a
                  href="/storage"
                  className="flex items-center gap-3 p-4 rounded-sm bg-inset hover:bg-hover transition-colors border border-line"
                >
                  <span className="w-10 h-10 rounded-full bg-domain-inventory text-fg-on-accent flex items-center justify-center shrink-0">
                    <Icon name="inventory_2" filled />
                  </span>
                  <span className="text-sm font-medium text-fg">View Live Stock</span>
                </a>
              </div>
            </section>

            <section className="bg-surface rounded-lg p-6 border border-line shadow-raised">
              <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
                <Icon name="notifications_active" />
                Recent Activity
              </h3>
              {data.alerts.length === 0 ? (
                <p className="text-sm text-fg-secondary">{dict.overview.dashboard.nothingNeedsYouBody}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {data.alerts.slice(0, 4).map((alert) => (
                    <li key={alert.id} className="flex items-start gap-3 py-3">
                      <span className="w-9 h-9 rounded-full bg-inset flex items-center justify-center shrink-0">
                        <Icon name={severityIcon(alert)} size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-fg">{alert.title}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <a
                href="/notifications"
                className="block w-full mt-4 py-2 text-center border border-line rounded-sm text-sm font-medium text-brand-fg hover:bg-hover transition-colors"
              >
                View All Activity
              </a>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
