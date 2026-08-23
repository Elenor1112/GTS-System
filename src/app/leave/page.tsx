import type { Metadata } from 'next';

import { Region, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { balancesFor, pendingRequests, requestsFor, awayOn } from '@/lib/services/leave';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

import { RequestLeaveForm, DecisionButtons } from './leave-forms';

export const metadata: Metadata = { title: 'Leave — GTS' };
export const dynamic = 'force-dynamic';

/**
 * LEAVE — balances, requests and the approval queue.
 *
 * Your own balances lead, because "how many days do I have left" is the
 * question this screen is opened for. The approval queue appears only
 * for somebody who can act on it, and shows the balance impact of each
 * request beside it: approving without seeing what it consumes is how a
 * balance ends up over-committed.
 */
export default async function LeavePage() {
  const actor = await requirePermission('leave.request');
  const dict = await t();
  const locale = await getLocale();

  const mayApprove = can(actor, 'leave.approve');
  const mayViewOthers = can(actor, 'leave.view');
  const year = new Date().getFullYear();

  const [balances, myRequests, queue, awayToday, leaveTypes] = await Promise.all([
    actor.employeeId ? balancesFor(actor.employeeId, year) : [],
    actor.employeeId ? requestsFor(actor.employeeId) : [],
    mayApprove ? pendingRequests() : [],
    mayViewOthers ? awayOn(new Date()) : [],
    db.leaveType.findMany({
      select: { id: true, key: true, nameEn: true, isPaid: true, requiresDocument: true },
      orderBy: { nameEn: 'asc' },
    }),
  ]);

  /* The balance each queued request would consume, so an approver sees
     the consequence rather than only the ask. */
  const queueBalances = await Promise.all(
    queue.map(async (request) => {
      const rows = await db.leaveBalance.findFirst({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year: request.startsOn.getUTCFullYear(),
        },
        select: { entitled: true, taken: true, pending: true },
      });
      return {
        requestId: request.id,
        remaining: rows
          ? Number(rows.entitled) - Number(rows.taken) - Number(rows.pending)
          : null,
      };
    }),
  );
  const remainingFor = (requestId: string) =>
    queueBalances.find((b) => b.requestId === requestId)?.remaining ?? null;

  return (
    <Shell active="/leave" domain="attendance">
      <main className="gts-page">
        <PageHead
          overline={dict.people.leave.overline}
          title={dict.people.leave.title}
          lede={
            mayApprove && queue.length > 0
              ? dict.people.leave.ledeWaiting
                  .replace('{count}', String(queue.length))
                  .replace('{plural}', queue.length === 1 ? '' : 's')
              : dict.people.leave.ledeLaw
          }
        />

        {/* ---------- Your balances ---------- */}
        {actor.employeeId ? (
          <Region title={dict.people.leave.balances.title.replace('{year}', String(year))}>
            {balances.length === 0 ? (
              <Empty
                title={dict.people.leave.balances.empty.title}
                body={dict.people.leave.balances.empty.body}
              />
            ) : (
              <div className="gts-balance-grid">
                {balances.map((balance) => (
                  <div key={balance.leaveTypeId} className="gts-balance">
                    <p className="gts-overline">{balance.nameEn}</p>
                    <p className="gts-balance-figure">
                      <span className="gts-num gts-num-lg">{balance.available.toString()}</span>
                      <span className="gts-meta">
                        {' '}
                        {dict.people.leave.balances.ofDays.replace(
                          '{entitled}',
                          balance.entitled.toString(),
                        )}
                      </span>
                    </p>
                    <p className="gts-meta">
                      {dict.people.leave.balances.taken.replace('{taken}', balance.taken.toString())}
                      {balance.pending.greaterThan(0) &&
                        dict.people.leave.balances.reservedPending.replace(
                          '{pending}',
                          balance.pending.toString(),
                        )}
                    </p>
                    {/* Reserved days are held from submission, not from
                        approval — that is what stops two requests
                        spending the same remaining day. */}
                    <div
                      className="gts-progress"
                      role="img"
                      aria-label={`${balance.available} of ${balance.entitled} days available`}
                    >
                      <div
                        className="gts-progress-bar"
                        style={{
                          inlineSize: balance.entitled.greaterThan(0)
                            ? `${Math.min(
                                100,
                                Math.round(
                                  (balance.available.toNumber() / balance.entitled.toNumber()) * 100,
                                ),
                              )}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Region>
        ) : (
          <Empty
            title={dict.people.leave.noEmployee.title}
            body={dict.people.leave.noEmployee.body}
          />
        )}

        {/* ---------- Request leave ---------- */}
        {actor.employeeId && leaveTypes.length > 0 && (
          <Region title={dict.people.leave.request.title}>
            <RequestLeaveForm
              leaveTypes={leaveTypes.map((lt) => ({
                id: lt.id,
                label: `${lt.nameEn}${lt.isPaid ? '' : dict.people.leave.request.unpaidSuffix}${
                  lt.requiresDocument ? dict.people.leave.request.documentRequiredSuffix : ''
                }`,
              }))}
              dict={dict.people.leave.request}
            />
          </Region>
        )}

        {/* ---------- The approval queue ---------- */}
        {mayApprove && (
          <Region title={dict.people.leave.queue.title.replace('{count}', String(queue.length))}>
            {queue.length === 0 ? (
              <Empty
                title={dict.people.leave.queue.empty.title}
                body={dict.people.leave.queue.empty.body}
              />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">{dict.people.leave.queue.employeeHeader}</th>
                      <th scope="col">{dict.people.leave.queue.typeHeader}</th>
                      <th scope="col">{dict.people.leave.queue.fromHeader}</th>
                      <th scope="col">{dict.people.leave.queue.toHeader}</th>
                      <th scope="col" className="gts-cell-num">{dict.people.leave.queue.workingDaysHeader}</th>
                      <th scope="col" className="gts-cell-num">{dict.people.leave.queue.leftAfterHeader}</th>
                      <th scope="col">{dict.people.leave.queue.reasonHeader}</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((request) => {
                      const remaining = remainingFor(request.id);
                      const days = Number(request.workingDays);
                      return (
                        <tr key={request.id} id={`request-${request.id}`}>
                          <th scope="row">
                            {request.employee.nameEn}
                            <span className="gts-meta gts-cell-sub">
                              {request.employee.code} · {request.employee.jobTitleEn}
                            </span>
                          </th>
                          <td>
                            {request.leaveType.nameEn}
                            {!request.leaveType.isPaid && (
                              <span className="gts-meta gts-cell-sub">{dict.people.leave.queue.unpaid}</span>
                            )}
                          </td>
                          <td>{formatDate(request.startsOn.toISOString(), locale)}</td>
                          <td>{formatDate(request.endsOn.toISOString(), locale)}</td>
                          <td className="gts-cell-num">
                            <span className="gts-num gts-num-sm">{days}</span>
                          </td>
                          <td className="gts-cell-num">
                            {remaining === null ? (
                              <span className="gts-meta">—</span>
                            ) : (
                              // Already net of this request: the days were
                              // reserved when it was submitted.
                              <span className="gts-num gts-num-sm">{remaining}</span>
                            )}
                          </td>
                          <td>
                            {request.reason ?? <span className="gts-meta">—</span>}
                          </td>
                          <td>
                            <DecisionButtons requestId={request.id} reference={request.ref} dict={dict.people.leave.decision} />
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

        {/* ---------- Your own requests ---------- */}
        {actor.employeeId && (
          <Region title={dict.people.leave.myRequests.title}>
            {myRequests.length === 0 ? (
              <Empty
                title={dict.people.leave.myRequests.empty.title}
                body={dict.people.leave.myRequests.empty.body}
              />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">{dict.people.leave.myRequests.referenceHeader}</th>
                      <th scope="col">{dict.people.leave.myRequests.typeHeader}</th>
                      <th scope="col">{dict.people.leave.myRequests.fromHeader}</th>
                      <th scope="col">{dict.people.leave.myRequests.toHeader}</th>
                      <th scope="col" className="gts-cell-num">{dict.people.leave.myRequests.daysHeader}</th>
                      <th scope="col">{dict.people.leave.myRequests.statusHeader}</th>
                      <th scope="col">{dict.people.leave.myRequests.decidedByHeader}</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {myRequests.map((request) => (
                      <tr key={request.id} id={`request-${request.id}`}>
                        <th scope="row">
                          <bdi>{request.ref}</bdi>
                        </th>
                        <td>{request.leaveType.nameEn}</td>
                        <td>{formatDate(request.startsOn.toISOString(), locale)}</td>
                        <td>{formatDate(request.endsOn.toISOString(), locale)}</td>
                        <td className="gts-cell-num">{request.workingDays.toString()}</td>
                        <td>
                          <Status tone={leaveTone(request.status)}>
                            {request.status.toLowerCase()}
                          </Status>
                          {request.decisionNote && (
                            <span className="gts-meta gts-cell-sub">{request.decisionNote}</span>
                          )}
                        </td>
                        <td>
                          {request.approver?.nameEn ?? <span className="gts-meta">—</span>}
                        </td>
                        <td>
                          {/* Cancelling an approved absence returns the
                              days; cancelling a pending one releases the
                              reservation. Both are the requester's call. */}
                          {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                            <DecisionButtons requestId={request.id} reference={request.ref} ownOnly dict={dict.people.leave.decision} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Region>
        )}

        {/* ---------- Coverage ---------- */}
        {mayViewOthers && (
          <Region title={dict.people.leave.away.title}>
            {awayToday.length === 0 ? (
              <Empty title={dict.people.leave.away.empty.title} body={dict.people.leave.away.empty.body} />
            ) : (
              <ul className="gts-list">
                {awayToday.map((request) => (
                  <li key={request.id} className="gts-list-row">
                    <div style={{ minInlineSize: 0 }}>
                      <span className="gts-list-title">{request.employee.nameEn}</span>
                      <p className="gts-meta">
                        {request.employee.jobTitleEn}
                        {request.employee.department && ` · ${request.employee.department}`}
                      </p>
                    </div>
                    <div className="gts-list-figure">
                      <span className="gts-meta">{request.leaveType.nameEn}</span>
                      <span className="gts-meta">
                        {dict.people.leave.away.until.replace(
                          '{date}',
                          formatDate(request.endsOn.toISOString(), locale),
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Region>
        )}
      </main>
    </Shell>
  );
}

function leaveTone(status: string) {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'REJECTED') return 'danger' as const;
  if (status === 'CANCELLED') return 'neutral' as const;
  return 'warning' as const;
}
