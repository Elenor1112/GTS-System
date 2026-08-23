import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { organisation } from '@/lib/services/settings';
import { projectDetail } from '@/lib/services/projects';
import { formatDate, splitAmount } from '@/lib/format';
import { CURRENCY } from '@/lib/egypt';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

import { AutoPrint } from '@/components/auto-print';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { nameEn: true } });
  return { title: project ? `${project.nameEn} — GTS` : 'Project — GTS' };
}

/**
 * THE PRINTABLE PROJECT SHEET.
 *
 * A document, not a screen: no rail, no navigation, nothing to click.
 * Mirrors the bill print page's shape so every printed record in the
 * system reads as the same family of document.
 */
export default async function ProjectPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('projects.view');
  const { id } = await params;
  const dict = await t();
  const locale = await getLocale();
  const d = dict.operations.projects.print;

  const [project, org] = await Promise.all([projectDetail(id), organisation()]);
  if (!project) notFound();

  const money = (v: number | string) => {
    const { negative, integer, fraction, decimal } = splitAmount(Number(v), locale);
    return `${negative ? '−' : ''}${CURRENCY.mark}${integer}${decimal}${fraction}`;
  };

  const billed = project.bills.reduce((sum, b) => sum + b.total.toNumber(), 0);
  const live = project.employees.filter((e) => !e.releasedOn);

  return (
    <main className="gts-page" style={{ maxInlineSize: '52rem', margin: '0 auto', padding: '2rem' }}>
      <AutoPrint />

      <div className="gts-no-print" style={{ marginBlockEnd: '2rem', display: 'flex', gap: '0.5rem' }}>
        <a href={`/projects/${project.id}`} className="gts-btn gts-btn-secondary">
          {d.backToProject}
        </a>
      </div>

      <header style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline">
          {d.sheetOverline} · {statusLabel(dict, project.status)}
        </p>
        <h1 className="gts-display" style={{ marginBlockStart: '0.25rem' }}>{project.nameEn}</h1>
        <p className="gts-meta">{project.code} · {org.nameEn}</p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
          gap: '1.5rem',
          marginBlockEnd: '2rem',
        }}
      >
        <div>
          <p className="gts-overline">{d.client}</p>
          <p style={{ fontWeight: 600 }}>{project.client.nameEn}</p>
          <p className="gts-meta">{project.client.code}</p>
        </div>
        <div>
          <p className="gts-overline">{d.dates}</p>
          <p>{project.startsOn ? formatDate(project.startsOn.toISOString(), locale) : '—'} – {project.endsOn ? formatDate(project.endsOn.toISOString(), locale) : '—'}</p>
        </div>
        <div>
          <p className="gts-overline">{d.site}</p>
          {project.location ? (
            <>
              <p>{project.location.addressLine}</p>
              <p className="gts-meta">{project.location.radiusMetres}m fence</p>
            </>
          ) : (
            <p className="gts-meta">{d.noSitePinned}</p>
          )}
        </div>
        <div>
          <p className="gts-overline">{d.budget}</p>
          <p>{project.budget ? money(project.budget.toString()) : '—'}</p>
          <p className="gts-overline" style={{ marginBlockStart: '0.75rem' }}>{d.billed}</p>
          <p>{money(billed)}</p>
        </div>
      </section>

      <section style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline" style={{ marginBlockEnd: '0.5rem' }}>{d.teamTitle}</p>
        {live.length === 0 ? (
          <p className="gts-meta">{d.noOneAssigned}</p>
        ) : (
          <table className="gts-table">
            <thead>
              <tr>
                <th scope="col">{d.colEmployee}</th>
                <th scope="col">{d.colRoleOnSite}</th>
                <th scope="col">{d.colAssigned}</th>
              </tr>
            </thead>
            <tbody>
              {live.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.employee.nameEn}</td>
                  <td>{assignment.roleOnSite ?? assignment.employee.jobTitleEn}</td>
                  <td>{formatDate(assignment.assignedOn.toISOString(), locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <p className="gts-overline" style={{ marginBlockEnd: '0.5rem' }}>{d.materialsTitle}</p>
        {project.products.length === 0 ? (
          <p className="gts-meta">{d.noMaterials}</p>
        ) : (
          <table className="gts-table">
            <thead>
              <tr>
                <th scope="col">{d.colProduct}</th>
                <th scope="col" className="gts-cell-num">{d.colAllocated}</th>
                <th scope="col" className="gts-cell-num">{d.colDelivered}</th>
                <th scope="col" className="gts-cell-num">{d.colReturned}</th>
                <th scope="col" className="gts-cell-num">{d.colRemaining}</th>
              </tr>
            </thead>
            <tbody>
              {project.products.map((row) => (
                <tr key={row.id}>
                  <td>{row.product.nameEn}</td>
                  <td className="gts-cell-num"><span className="gts-num">{row.allocated.toString()}</span></td>
                  <td className="gts-cell-num"><span className="gts-num">{row.delivered.toString()}</span></td>
                  <td className="gts-cell-num"><span className="gts-num">{row.returned.toString()}</span></td>
                  <td className="gts-cell-num"><span className="gts-num">{row.position.remaining.toString()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer style={{ marginBlockStart: '3rem' }}>
        <p className="gts-meta">{d.producedBy} {formatDate(new Date().toISOString(), locale)}.</p>
      </footer>
    </main>
  );
}

function statusLabel(dict: Awaited<ReturnType<typeof t>>, status: string) {
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
