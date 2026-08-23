import type { Metadata } from 'next';

import { Region, Status } from '@/components/primitives';
import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { allSettings } from '@/lib/services/settings';
import { CURRENCY, VAT_STANDARD, WHT_THRESHOLD, GOVERNORATES } from '@/lib/egypt';
import { MAX_ACCURACY_M } from '@/lib/geofence';
import { t } from '@/lib/i18n';

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
  const dict = await t();

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
          overline={dict.admin.settings.overline}
          title={dict.admin.settings.title}
          lede={dict.admin.settings.lede}
        />

        {!orgTrn && (
          <p className="gts-form-error" role="status">
            {dict.admin.settings.noTrnWarning}
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
          dict={dict.admin.settings}
        />

        {/* ---------- The market profile ----------
            Read-only: these are statutory, not preferences. Showing them
            is how somebody confirms the system is configured for Egypt
            rather than the market it was originally built for. */}
        <Region title={dict.admin.settings.market.title}>
          <div className="gts-stat-row">
            <Fact label={dict.admin.settings.market.currency} value={`${CURRENCY.code} — ${CURRENCY.nameEn}`} />
            <Fact label={dict.admin.settings.market.standardVat} value={`${VAT_STANDARD}%`} />
            <Fact label={dict.admin.settings.market.withholdingThreshold} value={`${CURRENCY.code} ${WHT_THRESHOLD}`} />
            <Fact label={dict.admin.settings.market.workingWeek} value={dict.admin.settings.market.workingWeekValue} />
            <Fact label={dict.admin.settings.market.timezone} value="Africa/Cairo" />
            <Fact label={dict.admin.settings.market.governorates} value={String(GOVERNORATES.length)} />
          </div>
          <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
            {dict.admin.settings.market.note}
          </p>
        </Region>

        {/* ---------- ETA ---------- */}
        <Region title={dict.admin.settings.eta.title}>
          <div className="gts-stat-row">
            <div className="gts-stat">
              <p className="gts-overline">{dict.admin.settings.eta.documentFormat}</p>
              <p className="gts-stat-value">
                <Status tone="success">{dict.admin.settings.eta.implemented}</Status>
              </p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">{dict.admin.settings.eta.transmission}</p>
              <p className="gts-stat-value">
                <Status tone="neutral">{dict.admin.settings.eta.notConfigured}</Status>
              </p>
            </div>
          </div>

          <p
            className="gts-meta"
            style={{ marginBlockStart: 'var(--gts-space-4)', maxInlineSize: 'var(--gts-prose-max)' }}
          >
            {dict.admin.settings.eta.body}
          </p>
        </Region>

        {/* ---------- What the system holds ---------- */}
        <Region title={dict.admin.settings.system.title}>
          <div className="gts-stat-row">
            <Fact label={dict.admin.settings.system.activeUsers} value={users.toLocaleString('en-US')} />
            <Fact label={dict.admin.settings.system.employees} value={employees.toLocaleString('en-US')} />
            <Fact label={dict.admin.settings.system.projects} value={projects.toLocaleString('en-US')} />
            <Fact label={dict.admin.settings.system.bills} value={bills.toLocaleString('en-US')} />
            <Fact label={dict.admin.settings.system.stockMovements} value={movements.toLocaleString('en-US')} />
            <Fact label={dict.admin.settings.system.auditEntries} value={auditEntries.toLocaleString('en-US')} />
          </div>
          <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
            {dict.admin.settings.system.signedInAs} {actor.nameEn} · {actor.roleNameEn}
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
