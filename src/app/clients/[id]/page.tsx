import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Region, Panel, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { clientDetail } from '@/lib/services/clients';
import { clientSummary, clientActivity, daysOverdue } from '@/lib/services/accounts';
import { GOVERNORATES, TRN } from '@/lib/egypt';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const client = await clientDetail(id);
  return { title: client ? `${client.nameEn} — GTS` : 'Client — GTS' };
}

/**
 * CLIENT — the whole relationship on one page.
 *
 * The spine is the lifecycle the business actually runs:
 *   Projects → Goods → Bills → Payments → Balance
 *
 * The activity timeline is assembled from real rows — a project's start
 * date, a bill's issue date, a payment's receipt date, a goods movement.
 * Nothing is synthesised: if an event appears here, a row caused it.
 */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('clients.view');
  const { id } = await params;
  const dict = await t();
  const locale = await getLocale();
  const d = dict.operations.clients.detail;

  const client = await clientDetail(id);
  if (!client) notFound();

  const [summary, activity] = await Promise.all([clientSummary(id), clientActivity(id, 40)]);

  const governorate = client.governorateCode
    ? GOVERNORATES.find((g) => g.code === client.governorateCode)?.en
    : null;

  const seesMoney = can(actor, 'accounts.view');

  return (
    <Shell active="/clients" domain="clients">
      <main className="gts-page">
        <PageHead
          overline={`Client · ${client.code}`}
          title={client.nameEn}
          lede={
            [
              client.contactName,
              governorate,
              client.trn ? `TRN ${TRN.format(client.trn)}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined
          }
          actions={
            <>
              {can(actor, 'projects.create') && (
                <a href={`/projects/new?clientId=${client.id}`} className="gts-btn gts-btn-secondary">
                  {d.newProject}
                </a>
              )}
              {can(actor, 'bills.create') && (
                <a href={`/bills/new?clientId=${client.id}`} className="gts-btn gts-btn-secondary">
                  {d.newBill}
                </a>
              )}
              {can(actor, 'clients.edit') && (
                <a href={`/clients/${client.id}/edit`} className="gts-btn gts-btn-primary">
                  {d.edit}
                </a>
              )}
              {seesMoney && (
                <a href={`/clients/${client.id}/print`} className="gts-btn gts-btn-secondary">
                  {d.printStatement}
                </a>
              )}
            </>
          }
        />

        {/* ---------- The account position ---------- */}
        {seesMoney && (
          <Region title={d.accountTitle}>
            <div className="gts-stat-row">
              <Figure label={d.figureBilledToDate} value={summary.billed.toNumber()} locale={locale} />
              <Figure label={d.figureCollected} value={summary.paid.toNumber()} locale={locale} />
              <Figure label={d.figureWithheld} value={summary.withheld.toNumber()} locale={locale} />
              <Figure
                label={d.figureOutstanding}
                value={summary.outstanding.toNumber()}
                tone={summary.outstanding.greaterThan(0) ? 'warning' : undefined}
                locale={locale}
              />
              <Figure
                label={d.figureOverdue}
                value={summary.overdue.toNumber()}
                tone={summary.overdue.greaterThan(0) ? 'danger' : undefined}
                locale={locale}
              />
            </div>

            {summary.ageing.total.greaterThan(0) && (
              <>
                <p className="gts-overline" style={{ marginBlockStart: 'var(--gts-space-6)' }}>
                  {d.ageingTitle}
                </p>
                <div className="gts-ageing">
                  {(
                    [
                      [d.ageingCurrent, summary.ageing.current, 'success'],
                      [d.ageing1to30, summary.ageing.days1to30, 'info'],
                      [d.ageing31to60, summary.ageing.days31to60, 'warning'],
                      [d.ageing61to90, summary.ageing.days61to90, 'warning'],
                      [d.ageingOver90, summary.ageing.over90, 'danger'],
                    ] as const
                  ).map(([label, amount, tone]) => (
                    <div key={label} className="gts-ageing-bucket" data-tone={tone}>
                      <span className="gts-overline">{label}</span>
                      {amount.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Amount value={amount.toNumber()} size="sm" currency={null} locale={locale} />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {client.creditLimit.greaterThan(0) && (
              <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
                {d.creditLimit} <Amount value={client.creditLimit.toNumber()} size="sm" currency={null} locale={locale} />
                {summary.outstanding.greaterThan(client.creditLimit) && (
                  <>
                    {' · '}
                    <Status tone="danger">{d.overLimit}</Status>
                  </>
                )}
                {' · '}{d.paymentTerms} {client.paymentTermsDays} days
              </p>
            )}
          </Region>
        )}

        {/* ---------- Projects ---------- */}
        <Region title={`${d.projectsTitle} (${client.projects.length})`}>
          {client.projects.length === 0 ? (
            <Empty
              title={d.emptyProjectsTitle}
              body={d.emptyProjectsBody}
              action={
                can(actor, 'projects.create') ? (
                  <a href={`/projects/new?clientId=${client.id}`} className="gts-btn gts-btn-accent">
                    {d.newProject}
                  </a>
                ) : undefined
              }
            />
          ) : (
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <thead>
                  <tr>
                    <th scope="col">{d.colProject}</th>
                    <th scope="col">{d.colStatus}</th>
                    <th scope="col">{d.colSite}</th>
                    <th scope="col" className="gts-cell-num">{d.colTeam}</th>
                    <th scope="col" className="gts-cell-num">{d.colBudget}</th>
                  </tr>
                </thead>
                <tbody>
                  {client.projects.map((project) => (
                    <tr key={project.id}>
                      <th scope="row">
                        <a href={`/projects/${project.id}`} className="gts-cell-link">
                          {project.nameEn}
                        </a>
                        <span className="gts-meta gts-cell-sub">{project.code}</span>
                      </th>
                      <td>
                        <Status tone={projectTone(project.status)}>
                          {projectStatusLabel(dict, project.status)}
                        </Status>
                      </td>
                      <td>
                        {project.location ? (
                          <a
                            href={`https://www.google.com/maps/@${project.location.latitude},${project.location.longitude},17z`}
                            target="_blank"
                            rel="noreferrer"
                            className="gts-cell-link"
                          >
                            {project.location.addressLine}
                          </a>
                        ) : (
                          <span className="gts-meta">{d.notPinned}</span>
                        )}
                      </td>
                      <td className="gts-cell-num">
                        <span className="gts-num gts-num-sm">{project._count.employees}</span>
                      </td>
                      <td className="gts-cell-num">
                        {project.budget ? (
                          <Amount value={project.budget.toNumber()} size="sm" currency={null} locale={locale} />
                        ) : (
                          <span className="gts-meta">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Region>

        {/* ---------- Goods ---------- */}
        {can(actor, 'inventory.view') && client.productPositions.length > 0 && (
          <Region title={d.goodsTitle}>
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">
                  {d.goodsCaption}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{d.colProduct}</th>
                    <th scope="col" className="gts-cell-num">{d.colDelivered}</th>
                    <th scope="col" className="gts-cell-num">{d.colReturned}</th>
                    <th scope="col" className="gts-cell-num">{d.colDamaged}</th>
                    <th scope="col" className="gts-cell-num">{d.colRetained}</th>
                  </tr>
                </thead>
                <tbody>
                  {client.productPositions.map((p) => (
                    <tr key={p.productId}>
                      <th scope="row">
                        <a href={`/products/${p.productId}`} className="gts-cell-link">
                          {p.nameEn}
                        </a>
                        <span className="gts-meta gts-cell-sub">
                          <bdi>{p.sku}</bdi> · {p.unit}
                        </span>
                      </th>
                      <td className="gts-cell-num">{p.delivered.toString()}</td>
                      <td className="gts-cell-num">
                        {p.returned.isZero() ? <span className="gts-meta">—</span> : p.returned.toString()}
                      </td>
                      <td className="gts-cell-num">
                        {p.damaged.isZero() ? (
                          <span className="gts-meta">—</span>
                        ) : (
                          <Status tone="warning">{p.damaged.toString()}</Status>
                        )}
                      </td>
                      <td className="gts-cell-num">
                        <strong>{p.retained.toString()}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Region>
        )}

        {/* ---------- Bills ---------- */}
        {can(actor, 'bills.view') && (
          <Region title={`${d.billsTitle} (${client.bills.length})`}>
            {client.bills.length === 0 ? (
              <Empty title={d.emptyBillsTitle} body={d.emptyBillsBody} />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">{d.colNumber}</th>
                      <th scope="col">{d.colProject}</th>
                      <th scope="col">{d.colIssued}</th>
                      <th scope="col">{d.colDue}</th>
                      <th scope="col">{d.colStatus}</th>
                      <th scope="col" className="gts-cell-num">{d.colTotal}</th>
                      <th scope="col" className="gts-cell-num">{d.colOutstanding}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.bills.map((bill) => {
                      const outstanding = bill.total
                        .minus(bill.whtAmount)
                        .minus(bill.paidAmount);
                      const late =
                        bill.status === 'OVERDUE' ? daysOverdue(bill.dueOn) : 0;
                      return (
                        <tr key={bill.id}>
                          <th scope="row">
                            <a href={`/bills/${bill.id}`} className="gts-cell-link">
                              <bdi>{bill.number}</bdi>
                            </a>
                          </th>
                          <td>{bill.project?.code ?? <span className="gts-meta">—</span>}</td>
                          <td>{formatDate(bill.issuedOn.toISOString(), locale)}</td>
                          <td>
                            {formatDate(bill.dueOn.toISOString(), locale)}
                            {late > 0 && (
                              <span className="gts-meta gts-cell-sub">{late} {d.daysLate}</span>
                            )}
                          </td>
                          <td>
                            <Status tone={billTone(bill.status)}>
                              {bill.status.toLowerCase().replace('_', ' ')}
                            </Status>
                          </td>
                          <td className="gts-cell-num">
                            <Amount value={bill.total.toNumber()} size="sm" currency={null} locale={locale} />
                          </td>
                          <td className="gts-cell-num">
                            {outstanding.lessThanOrEqualTo(0) ? (
                              <span className="gts-meta">{d.settled}</span>
                            ) : (
                              <Amount value={outstanding.toNumber()} size="sm" currency={null} locale={locale} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Region>
        )}

        {/* ---------- Activity ---------- */}
        <Region title={d.activityTitle}>
          {activity.length === 0 ? (
            <Empty
              title={d.emptyActivityTitle}
              body={d.emptyActivityBody}
            />
          ) : (
            <ol className="gts-timeline">
              {activity.map((event, index) => (
                <li key={`${event.kind}-${index}`} className="gts-timeline-row" data-kind={event.kind}>
                  <span className="gts-timeline-dot" aria-hidden="true" />
                  <div className="gts-timeline-body">
                    <p className="gts-timeline-title">
                      {event.href ? (
                        <a href={event.href} className="gts-cell-link">
                          {event.title}
                        </a>
                      ) : (
                        event.title
                      )}
                    </p>
                    <p className="gts-meta">{event.detail}</p>
                  </div>
                  <div className="gts-timeline-aside">
                    <span className="gts-meta">{formatDate(event.at.toISOString(), locale)}</span>
                    {event.amount && seesMoney && (
                      <Amount value={event.amount.toNumber()} size="sm" currency={null} locale={locale} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Region>
      </main>
    </Shell>
  );
}

function Figure({
  label,
  value,
  tone,
  locale,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warning';
  locale: 'en' | 'ar';
}) {
  return (
    <div className="gts-stat">
      <p className="gts-overline">{label}</p>
      <p className={tone ? `gts-stat-value gts-stat-${tone}` : 'gts-stat-value'}>
        <Amount value={value} size="md" locale={locale} />
      </p>
    </div>
  );
}

function projectStatusLabel(dict: Awaited<ReturnType<typeof t>>, status: string) {
  const f = dict.operations.projects.form;
  switch (status) {
    case 'PLANNING': return f.statusPlanning;
    case 'ACTIVE': return f.statusActive;
    case 'ON_HOLD': return f.statusOnHold;
    case 'COMPLETED': return f.statusCompleted;
    case 'CANCELLED': return f.statusCancelled;
    default: return status.toLowerCase().replace('_', ' ');
  }
}

function projectTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'COMPLETED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'ON_HOLD') return 'warning' as const;
  return 'neutral' as const;
}

function billTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'OVERDUE') return 'danger' as const;
  if (status === 'PARTIALLY_PAID' || status === 'PENDING_APPROVAL') return 'warning' as const;
  if (status === 'CANCELLED') return 'neutral' as const;
  return 'info' as const;
}
