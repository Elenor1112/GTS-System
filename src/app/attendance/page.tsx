import type { Metadata } from 'next';

import { Shell } from '@/components/shell';
import { Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { assignedSites, attendanceFor } from '@/lib/services/attendance';
import { getSetting } from '@/lib/services/settings';
import { formatSiteDate, formatSiteTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

import { CheckInPanel } from './check-in-panel';

export const metadata: Metadata = { title: 'Attendance — GTS' };
export const dynamic = 'force-dynamic';

/**
 * ATTENDANCE — where you are.
 *
 * A different register from the accounting surfaces: larger, softer, more
 * immediate, because it is used outdoors on a phone, one-handed, in
 * sunlight, in a hurry.
 *
 * The page is a SERVER component. It resolves who you are, which sites
 * you are assigned to, and where those sites actually are — none of which
 * a browser may be trusted to tell us. Only the part that needs the
 * device's geolocation is a client component, and even that only reports
 * a position: the server re-runs the fence before writing anything.
 */
export default async function AttendancePage() {
  const actor = await requirePermission('attendance.check_in');
  const dict = await t();
  const locale = await getLocale();

  // A user without an employee record has no attendance to take. That is
  // a real state — an accounts-only login — not an error.
  if (!actor.employeeId) {
    return (
      <Shell active="/attendance" domain="attendance">
        <main className="gts-page">
          <header>
            <p className="gts-overline">{dict.people.attendance.overline}</p>
            <h1 className="gts-page-title" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
              {dict.people.attendance.title}
            </h1>
          </header>
          <Empty
            title={dict.people.attendance.noEmployee.title}
            body={dict.people.attendance.noEmployee.body}
          />
        </main>
      </Shell>
    );
  }

  const [sites, workStart, lateThreshold, maxAccuracy] = await Promise.all([
    assignedSites(actor.employeeId),
    getSetting('attendance.workStart', '08:00'),
    getSetting('attendance.lateThresholdMinutes', 15),
    getSetting('attendance.maxAccuracyMetres', 200),
  ]);

  // The fortnight behind us, for the history strip.
  const from = new Date();
  from.setDate(from.getDate() - 14);
  const history = await attendanceFor(actor.employeeId, from, new Date());

  return (
    <Shell active="/attendance" domain="attendance">
      <main className="gts-page">
        <header>
          <p className="gts-overline">
            {dict.people.attendance.overline} · {formatSiteDate(new Date().toISOString(), locale)}
          </p>
          <h1 className="gts-page-title" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
            {dict.people.attendance.title}
          </h1>
        </header>

        {sites.length === 0 ? (
          <Empty
            title={dict.people.attendance.noSite.title}
            body={dict.people.attendance.noSite.body}
          />
        ) : (
          <div className="gts-checkin-stack">
            {sites.map((site) => (
              <CheckInPanel
                key={site.projectId}
                site={{
                  projectId: site.projectId,
                  projectCode: site.projectCode,
                  projectName: site.projectName,
                  clientName: site.clientName,
                  addressLine: site.addressLine,
                  latitude: site.latitude,
                  longitude: site.longitude,
                  radiusMetres: site.radiusMetres,
                }}
                today={
                  site.todayAttendance
                    ? {
                        id: site.todayAttendance.id,
                        checkInAt: site.todayAttendance.checkInAt.toISOString(),
                        checkOutAt: site.todayAttendance.checkOutAt?.toISOString() ?? null,
                        status: site.todayAttendance.status,
                        minutesLate: site.todayAttendance.minutesLate,
                        distanceMetres: site.todayAttendance.distanceMetres,
                      }
                    : null
                }
                maxAccuracyMetres={maxAccuracy}
                dict={dict.people.attendance.checkIn}
              />
            ))}
          </div>
        )}

        <section className="gts-region">
          <header className="gts-region-head">
            <h2 className="gts-region-title">{dict.people.attendance.history.title}</h2>
            <span className="gts-meta">
              {dict.people.attendance.history.workingDayNote
                .replace('{start}', workStart)
                .replace('{minutes}', String(lateThreshold))}
            </span>
          </header>

          {history.length === 0 ? (
            <Empty
              title={dict.people.attendance.history.empty.title}
              body={dict.people.attendance.history.empty.body}
            />
          ) : (
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <thead>
                  <tr>
                    <th scope="col">{dict.people.attendance.history.dateHeader}</th>
                    <th scope="col">{dict.people.attendance.history.projectHeader}</th>
                    <th scope="col">{dict.people.attendance.history.inHeader}</th>
                    <th scope="col">{dict.people.attendance.history.outHeader}</th>
                    <th scope="col">{dict.people.attendance.history.statusHeader}</th>
                    <th scope="col" className="gts-cell-num">{dict.people.attendance.history.distanceHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <th scope="row">{formatSiteDate(record.workDate.toISOString(), locale)}</th>
                      <td>{record.project.code}</td>
                      <td>{formatSiteTime(record.checkInAt.toISOString(), locale)}</td>
                      <td>
                        {record.checkOutAt ? (
                          formatSiteTime(record.checkOutAt.toISOString(), locale)
                        ) : (
                          <span className="gts-meta">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`gts-status gts-status-${
                            record.status === 'LATE' ? 'warning' : 'success'
                          }`}
                        >
                          {record.status.toLowerCase()}
                          {record.minutesLate > 0 && ` · ${record.minutesLate}m`}
                        </span>
                      </td>
                      <td className="gts-cell-num">{record.distanceMetres}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
