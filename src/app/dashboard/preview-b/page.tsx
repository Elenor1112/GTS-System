import type { Metadata } from 'next';

import { Shell, Empty, Glyph } from '@/components/shell';
import { requireActor } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { buildDashboard, type DashboardAlert } from '@/lib/services/dashboard';
import { formatDate, splitAmount } from '@/lib/format';
import { getLocale } from '@/lib/preferences';
import { t } from '@/lib/i18n';
import { CURRENCY } from '@/lib/egypt';
import styles from './preview-b.module.css';

export const metadata: Metadata = { title: 'Dashboard preview B — GTS' };
export const dynamic = 'force-dynamic';

const LEAD_ALERT_COUNT = 3;

function toneIcon(tone: DashboardAlert['tone']) {
  if (tone === 'danger') return 'bills';
  if (tone === 'warning') return 'storage';
  return 'bell';
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function Figure({
  label,
  value,
  locale,
  size = 'normal',
  tone,
}: {
  label: string;
  value: number;
  locale: 'en' | 'ar';
  size?: 'normal' | 'large';
  tone?: 'danger';
}) {
  const { negative, integer, fraction, decimal } = splitAmount(value, locale);
  return (
    <div className={styles.figureCard}>
      <p className={styles.figureLabel}>{label}</p>
      <p
        className={`${styles.figureValue} ${size === 'large' ? styles.figureValueLarge : ''} ${tone === 'danger' ? styles.figureValueDanger : ''}`}
      >
        <span className={styles.figureCurrency}>{CURRENCY.mark}</span>
        {negative ? '−' : ''}
        {integer}
        <span className={styles.figureFraction}>
          {decimal}
          {fraction}
        </span>
      </p>
    </div>
  );
}

export default async function DashboardPreviewB() {
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
      <div className={styles.board}>
        <header className={styles.masthead}>
          <div className={styles.mastheadAvatar} aria-hidden="true">
            {initials(actor.nameEn)}
          </div>
          <div>
            <p className={styles.mastheadDate}>{formatDate(new Date().toISOString(), locale)}</p>
            <h1 className={styles.greeting}>
              {dict.overview.dashboard.goodMorning}, {firstName} <span className={styles.wave}>👋</span>
            </h1>
          </div>
        </header>

        {/* ---------- NEEDS ATTENTION ---------- */}
        <section className={styles.section}>
          <div className={styles.sectionHeadRow}>
            <h2 className={styles.sectionLabelLead}>{dict.overview.dashboard.needsAttention}</h2>
            {data.alerts.length > 0 && <span className={styles.sectionCount}>{data.alerts.length}</span>}
          </div>

          {data.alerts.length === 0 ? (
            <div className={styles.allClear}>
              <span className={styles.allClearIcon}>
                <Glyph name="permissions" />
              </span>
              <div>
                <p className={styles.allClearTitle}>{dict.overview.dashboard.nothingNeedsYouTitle}</p>
                <p className={styles.allClearBody}>{dict.overview.dashboard.nothingNeedsYouBody}</p>
              </div>
            </div>
          ) : (
            <>
              <ul className={styles.alertList}>
                {leadAlerts.map((alert) => (
                  <li key={alert.id} className={styles.alertCard} data-tone={alert.tone}>
                    <span className={styles.alertIcon} data-tone={alert.tone}>
                      <Glyph name={toneIcon(alert.tone)} />
                    </span>
                    <div className={styles.alertBody}>
                      <p className={styles.alertTitle}>{alert.title}</p>
                      <p className={styles.alertDetail}>{alert.detail}</p>
                    </div>
                    <a href={alert.href} className={styles.alertAction}>
                      {alert.action}
                    </a>
                  </li>
                ))}
              </ul>
              {restAlertsCount > 0 && (
                <a href="/notifications" className={styles.attentionMore}>
                  {dict.overview.dashboard.seeMore.replace('{count}', String(restAlertsCount))}
                </a>
              )}
            </>
          )}
        </section>

        {/* ---------- TODAY ---------- */}
        {seesMoney ? (
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>{dict.overview.dashboard.today}</h2>
            <div className={styles.todayGrid}>
              <Figure
                label={dict.overview.dashboard.moneyComingIn}
                value={data.receivable.toNumber()}
                locale={locale}
                size="large"
              />
              <Figure
                label={dict.overview.dashboard.collectedThisMonth}
                value={data.collectedThisMonth.toNumber()}
                locale={locale}
              />
              {data.overdueReceivable.greaterThan(0) && (
                <Figure
                  label={dict.overview.dashboard.overdue}
                  value={data.overdueReceivable.toNumber()}
                  locale={locale}
                  tone="danger"
                />
              )}
            </div>
          </section>
        ) : (
          <section className={styles.section}>
            <p className={styles.plainSummary}>
              {data.counts.activeProjects}{' '}
              {data.counts.activeProjects === 1
                ? dict.overview.dashboard.activeProjectsSummary
                : dict.overview.dashboard.activeProjectsSummaryPlural}
              . {dict.overview.dashboard.railHint}
            </p>
          </section>
        )}

        {/* ---------- YOUR WORK ---------- */}
        {can(actor, 'projects.view') && (
          <section className={styles.section}>
            <div className={styles.sectionHeadRow}>
              <h2 className={styles.sectionLabel}>{dict.overview.dashboard.yourWork}</h2>
              <a href="/projects" className={styles.sectionLink}>
                {dict.overview.dashboard.allProjects}
              </a>
            </div>

            {data.projects.length === 0 ? (
              <Empty
                title={dict.overview.dashboard.noActiveProjects}
                body={dict.overview.dashboard.createProjectHint}
              />
            ) : (
              <ul className={styles.workList}>
                {data.projects.slice(0, 5).map((p) => {
                  const over = p.consumedPct !== null && p.consumedPct > 100;
                  return (
                    <li key={p.id}>
                      <a href={`/projects/${p.id}`} className={styles.workCard}>
                        <span className={styles.workThumb} aria-hidden="true">
                          <Glyph name="projects" />
                        </span>
                        <div className={styles.workMain}>
                          <p className={styles.workName}>{p.nameEn}</p>
                          <p className={styles.workClient}>{p.clientName}</p>
                        </div>
                        {p.consumedPct !== null ? (
                          <div className={styles.workProgress}>
                            <div className={styles.workBar}>
                              <div
                                className={styles.workBarFill}
                                data-over={over}
                                style={{ width: `${Math.min(100, p.consumedPct)}%` }}
                              />
                            </div>
                            <span className={styles.workPct}>
                              {p.consumedPct}% {dict.overview.dashboard.percentBilledSuffix}
                            </span>
                          </div>
                        ) : (
                          <span className={styles.miniMeta}>{dict.overview.dashboard.noBudgetSetShort}</span>
                        )}
                        <span className={styles.workChevron} aria-hidden="true">
                          <Glyph name="dashboard" />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* ---------- EVERYTHING ELSE ---------- */}
        {(can(actor, 'inventory.view') || can(actor, 'attendance.view')) && (
          <div className={styles.lowerGrid}>
            {can(actor, 'inventory.view') && (
              <div className={styles.lowerPanel}>
                <div className={styles.sectionHeadRow}>
                  <p className={styles.lowerLabel}>
                    <span className={styles.lowerIcon} data-domain="inventory">
                      <Glyph name="storage" />
                    </span>
                    {dict.overview.dashboard.storage}
                  </p>
                  <a href="/storage" className={styles.sectionLink}>
                    {dict.overview.dashboard.all}
                  </a>
                </div>
                {data.warehouses.length === 0 ? (
                  <Empty
                    title={dict.overview.dashboard.noWarehouses}
                    body={dict.overview.dashboard.createWarehouseHint}
                  />
                ) : (
                  <ul className={styles.miniList}>
                    {data.warehouses.map((w) => (
                      <li key={w.id} className={styles.miniRow}>
                        <span className={styles.miniAvatar}>{initials(w.nameEn)}</span>
                        <div className={styles.miniMain}>
                          <a href={`/storage/${w.id}`}>{w.nameEn}</a>
                          <p className={styles.miniMeta}>
                            {w.distinctProducts}{' '}
                            {w.distinctProducts === 1
                              ? dict.overview.dashboard.productInStock
                              : dict.overview.dashboard.productsInStock}
                          </p>
                        </div>
                        <span className={styles.miniNum}>{w.totalUnits.toString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {can(actor, 'attendance.view') && (
              <div className={styles.lowerPanel}>
                <div className={styles.sectionHeadRow}>
                  <p className={styles.lowerLabel}>
                    <span className={styles.lowerIcon} data-domain="attendance">
                      <Glyph name="attendance" />
                    </span>
                    {dict.overview.dashboard.onSiteToday}
                  </p>
                  <a href="/attendance" className={styles.sectionLink}>
                    {dict.overview.dashboard.all}
                  </a>
                </div>
                {data.attendanceToday.expected === 0 ? (
                  <Empty title={dict.overview.dashboard.nobodyAssigned} body={dict.overview.dashboard.nobodyAssignedBody} />
                ) : data.attendanceToday.isWeekend ? (
                  <Empty title={dict.overview.dashboard.weekend} body={dict.overview.dashboard.weekendBody} />
                ) : (
                  <>
                    <div className={styles.attendanceStrip}>
                      <div className={styles.attendanceStat}>
                        <p className={styles.figureLabel}>{dict.overview.dashboard.present}</p>
                        <p className={styles.attendanceFigure} data-tone="success">{data.attendanceToday.present}</p>
                      </div>
                      <div className={styles.attendanceStat}>
                        <p className={styles.figureLabel}>{dict.overview.dashboard.late}</p>
                        <p className={styles.attendanceFigure} data-tone={data.attendanceToday.late > 0 ? 'warning' : undefined}>
                          {data.attendanceToday.late}
                        </p>
                      </div>
                      <div className={styles.attendanceStat}>
                        <p className={styles.figureLabel}>{dict.overview.dashboard.notInYet}</p>
                        <p
                          className={styles.attendanceFigure}
                          data-tone={
                            data.attendanceToday.missing > 0 && !data.attendanceToday.beforeWorkStart
                              ? 'danger'
                              : undefined
                          }
                        >
                          {data.attendanceToday.missing}
                        </p>
                      </div>
                    </div>
                    <p className={styles.attendanceNote}>
                      {data.attendanceToday.expected} {dict.overview.dashboard.peopleExpected}
                      {data.attendanceToday.beforeWorkStart &&
                        data.attendanceToday.missing > 0 &&
                        ` — ${dict.overview.dashboard.workingDayNotStarted}`}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
