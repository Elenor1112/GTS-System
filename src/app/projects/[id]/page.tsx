import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Region, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { projectDetail } from '@/lib/services/projects';
import { projectFinancials } from '@/lib/services/accounts';
import { siteRoster } from '@/lib/services/attendance';
import { navigationUrl } from '@/lib/geofence';
import { GOVERNORATES } from '@/lib/egypt';
import { formatDate } from '@/lib/format';

import { LocationForm } from './location-form';
import { AssignForm, ReleaseButton } from './assign-form';
import { AllocateForm, RowActions, type StockOption } from './materials-form';

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
 * PROJECT — the operational record.
 *
 * The site location comes first among the editable sections, because it
 * gates attendance: until it exists, everyone assigned here is unable to
 * check in, and that is the failure most likely to be discovered at
 * 07:30 on a Sunday rather than at a desk.
 */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('projects.view');
  const { id } = await params;

  const project = await projectDetail(id);
  if (!project) notFound();

  // Stock is only offered where it exists. `quantity - reserved` is what
  // a new allocation may actually take: the reserved part is already
  // committed to another project, and offering it here would produce a
  // form whose only outcome is an INSUFFICIENT_STOCK error.
  const canMoveStock = can(actor, 'inventory.manage');

  const [financials, roster, candidates, stockRows, warehouses] = await Promise.all([
    can(actor, 'accounts.view') ? projectFinancials(id) : null,
    can(actor, 'attendance.view') ? siteRoster(id) : null,
    can(actor, 'projects.assign')
      ? db.employee.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            // Only people not already on this site.
            projects: { none: { projectId: id, releasedOn: null } },
          },
          select: { id: true, code: true, nameEn: true, jobTitleEn: true },
          orderBy: { nameEn: 'asc' },
        })
      : [],
    canMoveStock
      ? db.warehouseStock.findMany({
          where: {
            quantity: { gt: 0 },
            warehouse: { deletedAt: null, isActive: true },
            product: { deletedAt: null, isActive: true },
          },
          select: {
            quantity: true,
            reserved: true,
            warehouse: { select: { id: true, code: true, nameEn: true } },
            product: { select: { id: true, sku: true, nameEn: true, unit: true, salePrice: true } },
          },
        })
      : [],
    // Returns need a destination even for a product this warehouse has
    // never held, so the list is every open warehouse rather than only
    // those currently holding stock.
    canMoveStock
      ? db.warehouse.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true, code: true, nameEn: true },
          orderBy: { nameEn: 'asc' },
        })
      : [],
  ]);

  // Flat stock rows → one entry per product, carrying the warehouses that
  // hold it. Decimal never crosses to the client: it serialises to a
  // string so the quantity the user reads is the quantity stored.
  const stockByProduct = new Map<string, StockOption>();
  for (const row of stockRows) {
    const available = row.quantity.minus(row.reserved);
    if (available.lessThanOrEqualTo(0)) continue;

    let entry = stockByProduct.get(row.product.id);
    if (!entry) {
      entry = {
        id: row.product.id,
        sku: row.product.sku,
        nameEn: row.product.nameEn,
        unit: row.product.unit,
        salePrice: row.product.salePrice.toString(),
        warehouses: [],
      };
      stockByProduct.set(row.product.id, entry);
    }
    entry.warehouses.push({
      id: row.warehouse.id,
      code: row.warehouse.code,
      nameEn: row.warehouse.nameEn,
      available: available.toString(),
    });
  }
  const stockOptions = [...stockByProduct.values()].sort((a, b) =>
    a.nameEn.localeCompare(b.nameEn),
  );

  // A cancelled or completed project refuses allocation in the service;
  // the form says so up front rather than after a submit.
  const closed = project.status === 'CANCELLED' || project.status === 'COMPLETED';

  const governorate = project.location
    ? GOVERNORATES.find((g) => g.code === project.location!.governorateCode)?.en
    : null;

  const live = project.employees.filter((e) => !e.releasedOn);

  return (
    <Shell active="/projects" domain="projects">
      <main className="gts-page">
        <PageHead
          overline={`Project · ${project.code}`}
          title={project.nameEn}
          lede={`${project.client.nameEn}${governorate ? ` · ${governorate}` : ''}`}
          actions={
            <>
              <Status tone={statusTone(project.status)}>
                {project.status.toLowerCase().replace('_', ' ')}
              </Status>
              {can(actor, 'projects.edit') && (
                <a href={`/projects/${project.id}/edit`} className="gts-btn gts-btn-primary">
                  Edit
                </a>
              )}
            </>
          }
        />

        {/* ---------- The site ---------- */}
        <Region title="Site location">
          {!project.location && (
            <p className="gts-form-error" role="status">
              This project has no site location. Nobody assigned to it can check in until one
              is pinned — attendance is judged against these coordinates.
            </p>
          )}

          {project.location && (
            <div className="gts-stat-row" style={{ marginBlockEnd: 'var(--gts-space-5)' }}>
              <div className="gts-stat">
                <p className="gts-overline">Address</p>
                <p className="gts-stat-value">{project.location.addressLine}</p>
              </div>
              <div className="gts-stat">
                <p className="gts-overline">Coordinates</p>
                <p className="gts-stat-value">
                  <span className="gts-num gts-num-sm">
                    {project.location.latitude.toString()}, {project.location.longitude.toString()}
                  </span>
                </p>
              </div>
              <div className="gts-stat">
                <p className="gts-overline">Check-in radius</p>
                <p className="gts-stat-value">
                  <span className="gts-num gts-num-md">{project.location.radiusMetres}</span>
                  <span className="gts-num-currency">m</span>
                </p>
              </div>
              <div className="gts-stat">
                <p className="gts-overline">Navigate</p>
                <p className="gts-stat-value">
                  <a
                    href={navigationUrl(
                      {
                        lat: Number(project.location.latitude),
                        lng: Number(project.location.longitude),
                      },
                      project.nameEn,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="gts-btn gts-btn-secondary gts-btn-sm"
                  >
                    Open in Google Maps
                  </a>
                </p>
              </div>
            </div>
          )}

          {can(actor, 'projects.location') ? (
            <LocationForm
              projectId={project.id}
              existing={
                project.location
                  ? {
                      addressLine: project.location.addressLine,
                      governorateCode: project.location.governorateCode,
                      // Decimal crosses to the client as a string: a
                      // rounded coordinate moves the fence.
                      latitude: project.location.latitude.toString(),
                      longitude: project.location.longitude.toString(),
                      radiusMetres: project.location.radiusMetres,
                      siteType: project.location.siteType,
                    }
                  : null
              }
            />
          ) : (
            !project.location && (
              <p className="gts-meta">
                Ask an administrator to pin this site.
              </p>
            )
          )}
        </Region>

        {/* ---------- The team ---------- */}
        <Region title={`Team (${live.length})`}>
          {can(actor, 'projects.assign') && (
            <AssignForm
              projectId={project.id}
              candidates={candidates}
              hasLocation={Boolean(project.location)}
            />
          )}

          {project.employees.length === 0 ? (
            <Empty
              title="Nobody assigned"
              body="Assign the people working on this site so they can record attendance here."
            />
          ) : (
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Role on site</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">Today</th>
                    {can(actor, 'projects.assign') && <th scope="col" />}
                  </tr>
                </thead>
                <tbody>
                  {project.employees.map((assignment) => {
                    const attendance = roster?.find(
                      (r) => r.employee.id === assignment.employee.id,
                    );
                    return (
                      <tr key={assignment.id}>
                        <th scope="row">
                          {assignment.employee.nameEn}
                          <span className="gts-meta gts-cell-sub">
                            {assignment.employee.code} · {assignment.employee.jobTitleEn}
                          </span>
                        </th>
                        <td>{assignment.roleOnSite ?? <span className="gts-meta">—</span>}</td>
                        <td>
                          {formatDate(assignment.assignedOn.toISOString())}
                          {assignment.releasedOn && (
                            <span className="gts-meta gts-cell-sub">
                              released {formatDate(assignment.releasedOn.toISOString())}
                            </span>
                          )}
                        </td>
                        <td>
                          {assignment.releasedOn ? (
                            <span className="gts-meta">—</span>
                          ) : attendance?.attendance ? (
                            <Status tone={attendance.attendance.status === 'LATE' ? 'warning' : 'success'}>
                              {attendance.attendance.status.toLowerCase()}
                            </Status>
                          ) : (
                            <span className="gts-meta">not in</span>
                          )}
                        </td>
                        {can(actor, 'projects.assign') && (
                          <td>
                            {!assignment.releasedOn && (
                              <ReleaseButton
                                assignmentId={assignment.id}
                                projectId={project.id}
                                name={assignment.employee.nameEn}
                              />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Region>

        {/* ---------- Materials ---------- */}
        {can(actor, 'inventory.view') && (
          <Region title="Materials">
            {canMoveStock && (
              <AllocateForm projectId={project.id} products={stockOptions} closed={closed} />
            )}

            {project.products.length === 0 ? (
              <Empty
                title="Nothing allocated"
                body="Stock allocated to this project from a warehouse appears here, with what has been delivered, returned and written off."
              />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="gts-cell-num">Allocated</th>
                      <th scope="col" className="gts-cell-num">Delivered</th>
                      <th scope="col" className="gts-cell-num">Returned</th>
                      <th scope="col" className="gts-cell-num">Damaged</th>
                      <th scope="col" className="gts-cell-num">In transit</th>
                      <th scope="col" className="gts-cell-num">On site</th>
                      {canMoveStock && <th scope="col" />}
                    </tr>
                  </thead>
                  <tbody>
                    {project.products.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">
                          <a href={`/products/${row.product.id}`} className="gts-cell-link">
                            {row.product.nameEn}
                          </a>
                          <span className="gts-meta gts-cell-sub">
                            <bdi>{row.product.sku}</bdi> · {row.product.unit}
                          </span>
                        </th>
                        <td className="gts-cell-num">{row.position.allocated.toString()}</td>
                        <td className="gts-cell-num">{row.position.delivered.toString()}</td>
                        <td className="gts-cell-num">
                          {row.position.returned.isZero() ? (
                            <span className="gts-meta">—</span>
                          ) : (
                            row.position.returned.toString()
                          )}
                        </td>
                        <td className="gts-cell-num">
                          {row.position.damaged.isZero() ? (
                            <span className="gts-meta">—</span>
                          ) : (
                            <Status tone="warning">{row.position.damaged.toString()}</Status>
                          )}
                        </td>
                        <td className="gts-cell-num">
                          {row.position.inTransit.isZero() ? (
                            <span className="gts-meta">—</span>
                          ) : (
                            row.position.inTransit.toString()
                          )}
                        </td>
                        <td className="gts-cell-num">
                          <strong>{row.position.remaining.toString()}</strong>
                        </td>
                        {canMoveStock && (
                          <td>
                            <RowActions
                              projectId={project.id}
                              productId={row.product.id}
                              productName={row.product.nameEn}
                              unit={row.product.unit}
                              inTransit={row.position.inTransit.toString()}
                              onSite={row.position.remaining.toString()}
                              warehouses={warehouses}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Region>
        )}

        {/* ---------- Financials ---------- */}
        {financials && (
          <Region title="Financial position">
            <div className="gts-stat-row">
              <Figure label="Budget" value={financials.budget?.toNumber() ?? null} />
              <Figure label="Billed" value={financials.billed.toNumber()} />
              <Figure label="Collected" value={financials.collected.toNumber()} />
              <Figure
                label="Outstanding"
                value={financials.outstanding.toNumber()}
                tone={financials.outstanding.greaterThan(0) ? 'warning' : undefined}
              />
              <Figure label="Materials on site" value={
                financials.materialsAllocated.minus(financials.materialsReturned).toNumber()
              } />
              <Figure label="Labour to date" value={financials.labourCost.toNumber()} />
            </div>
            {financials.remainingBudget && (
              <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
                {financials.remainingBudget.isNegative() ? 'Over budget by ' : 'Budget remaining '}
                <Amount value={Math.abs(financials.remainingBudget.toNumber())} size="sm" currency={null} />
                {' · '}
                {financials.attendanceDays} attendance day
                {financials.attendanceDays === 1 ? '' : 's'} recorded
              </p>
            )}
          </Region>
        )}
      </main>
    </Shell>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: 'danger' | 'warning';
}) {
  return (
    <div className="gts-stat">
      <p className="gts-overline">{label}</p>
      <p className={tone ? `gts-stat-value gts-stat-${tone}` : 'gts-stat-value'}>
        {value === null ? (
          <span className="gts-meta">not set</span>
        ) : (
          <Amount value={value} size="md" />
        )}
      </p>
    </div>
  );
}

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'COMPLETED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'ON_HOLD') return 'warning' as const;
  return 'neutral' as const;
}
