import type { Metadata } from 'next';

import { Region, Status } from '@/components/primitives';
import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { allSettings } from '@/lib/services/settings';
import { CURRENCY, VAT_STANDARD, WHT_THRESHOLD, GOVERNORATES } from '@/lib/egypt';
import { MAX_ACCURACY_M } from '@/lib/geofence';

import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Administration — GTS' };
export const dynamic = 'force-dynamic';

/**
 * ADMINISTRATION — the values business logic reads.
 *
 * These are not deployment configuration: they are business decisions an
 * administrator changes from a screen. The geofence default, the late
 * threshold and the company's own tax identity all feed code paths that
 * run server-side, so a change here alters what the system accepts.
 *
 * The ETA panel reports the truth: the document format is implemented,
 * the transmission is not, and no credential exists to make it so.
 */
export default async function AdminPage() {
  const actor = await requirePermission('settings.manage');

  const [settings, counts] = await Promise.all([
    allSettings(),
    Promise.all([
      db.user.count({ where: { deletedAt: null, isActive: true } }),
      db.employee.count({ where: { deletedAt: null, isActive: true } }),
      db.project.count({ where: { deletedAt: null } }),
      db.electronicBill.count({ where: { deletedAt: null } }),
      db.inventoryTransaction.count(),
      db.auditLog.count(),
    ]),
  ]);

  const [users, employees, projects, bills, movements, auditEntries] = counts;
  const orgTrn = String(settings['org.trn'] ?? '');

  return (
    <Shell active="/admin" domain="admin">
      <main className="gts-page">
        <PageHead
          overline="System"
          title="Administration"
          lede="The values the business logic reads. Changing the geofence radius or the late threshold changes what the server accepts, not merely what a screen displays."
        />

        {!orgTrn && (
          <p className="gts-form-error" role="status">
            No tax registration number is set for this organisation. Every invoice you issue is
            missing the issuer TRN, which makes it invalid as an Egyptian tax document.
          </p>
        )}

        <SettingsForm
          values={{
            'org.nameEn': String(settings['org.nameEn'] ?? ''),
            'org.nameAr': String(settings['org.nameAr'] ?? ''),
            'org.trn': orgTrn,
            'org.commercialRegNo': String(settings['org.commercialRegNo'] ?? ''),
            'org.addressLine': String(settings['org.addressLine'] ?? ''),
            'org.governorateCode': Number(settings['org.governorateCode'] ?? 21),
            'attendance.workStart': String(settings['attendance.workStart'] ?? '08:00'),
            'attendance.workEnd': String(settings['attendance.workEnd'] ?? '17:00'),
            'attendance.lateThresholdMinutes': Number(
              settings['attendance.lateThresholdMinutes'] ?? 15,
            ),
            'attendance.defaultRadiusMetres': Number(
              settings['attendance.defaultRadiusMetres'] ?? 200,
            ),
            'attendance.maxAccuracyMetres': Number(
              settings['attendance.maxAccuracyMetres'] ?? MAX_ACCURACY_M,
            ),
            'bills.defaultPaymentTermsDays': Number(
              settings['bills.defaultPaymentTermsDays'] ?? 30,
            ),
          }}
          governorates={GOVERNORATES.map((g) => ({ value: g.code, label: `${g.en} — ${g.ar}` }))}
        />

        {/* ---------- The market profile ----------
            Read-only: these are statutory, not preferences. Showing them
            is how somebody confirms the system is configured for Egypt
            rather than the market it was originally built for. */}
        <Region title="Market">
          <div className="gts-stat-row">
            <Fact label="Currency" value={`${CURRENCY.code} — ${CURRENCY.nameEn}`} />
            <Fact label="Standard VAT" value={`${VAT_STANDARD}%`} />
            <Fact label="Withholding threshold" value={`${CURRENCY.code} ${WHT_THRESHOLD}`} />
            <Fact label="Working week" value="Sunday – Thursday" />
            <Fact label="Timezone" value="Africa/Cairo" />
            <Fact label="Governorates" value={String(GOVERNORATES.length)} />
          </div>
          <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
            Statutory values, set in <bdi>src/lib/egypt.ts</bdi> rather than here — VAT is 14%
            because Law 67 of 2016 says so, not because somebody chose it.
          </p>
        </Region>

        {/* ---------- ETA ---------- */}
        <Region title="Egyptian Tax Authority e-invoicing">
          <div className="gts-stat-row">
            <div className="gts-stat">
              <p className="gts-overline">Document format</p>
              <p className="gts-stat-value">
                <Status tone="success">Implemented</Status>
              </p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">Transmission</p>
              <p className="gts-stat-value">
                <Status tone="neutral">Not configured</Status>
              </p>
            </div>
          </div>

          <p
            className="gts-meta"
            style={{ marginBlockStart: 'var(--gts-space-4)', maxInlineSize: 'var(--gts-prose-max)' }}
          >
            Bills are produced in the ETA&rsquo;s shape: both parties&rsquo; registration numbers,
            GPC item codes, per-line VAT and the required document fields. They are{' '}
            <strong>not transmitted</strong>. Submission needs taxpayer credentials, a client
            id and secret, and an e-seal certificate to sign the canonical serialisation — none
            of which can live in this repository. No document shows a UUID, because none has
            been issued; inventing one would fabricate a compliance record.
          </p>
        </Region>

        {/* ---------- What the system holds ---------- */}
        <Region title="System">
          <div className="gts-stat-row">
            <Fact label="Active users" value={users.toLocaleString('en-US')} />
            <Fact label="Employees" value={employees.toLocaleString('en-US')} />
            <Fact label="Projects" value={projects.toLocaleString('en-US')} />
            <Fact label="Bills" value={bills.toLocaleString('en-US')} />
            <Fact label="Stock movements" value={movements.toLocaleString('en-US')} />
            <Fact label="Audit entries" value={auditEntries.toLocaleString('en-US')} />
          </div>
          <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
            Signed in as {actor.nameEn} · {actor.roleNameEn}
          </p>
        </Region>
      </main>
    </Shell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="gts-stat">
      <p className="gts-overline">{label}</p>
      <p className="gts-stat-value">{value}</p>
    </div>
  );
}
