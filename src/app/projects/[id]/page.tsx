import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { projectDetail } from '@/lib/services/projects';
import { projectFinancials } from '@/lib/services/accounts';
import { siteRoster } from '@/lib/services/attendance';
import { navigationUrl } from '@/lib/geofence';
import { GOVERNORATES } from '@/lib/egypt';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

import { LocationForm } from './location-form';
import { AssignForm, ReleaseButton } from './assign-form';
import { AllocateForm, RowActions, TotalOnSitePrice, type StockOption } from './materials-form';

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
  const dict = await t();
  const locale = await getLocale();
  const d = dict.operations.projects.detail;

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
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={`Project · ${project.code}`}
          title={project.nameEn}
          lede={`${project.client.nameEn}${governorate ? ` · ${governorate}` : ''}`}
          actions={
            <>
              <Status tone={statusTone(project.status)}>
                {statusLabel(dict, project.status)}
              </Status>
              {can(actor, 'projects.edit') && (
                <a
                  href={`/projects/${project.id}/edit`}
                  className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  <Icon name="edit" />
                  {d.edit}
                </a>
              )}
              <a
                href={`/projects/${project.id}/print`}
                className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center gap-2"
              >
                <Icon name="print" />
                {d.print}
              </a>
            </>
          }
        />

        {/* ---------- The site ---------- */}
        <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">{d.siteLocationTitle}</h2>

          {!project.location && (
            <p className="px-4 py-3 rounded-sm bg-danger-bg border border-danger-br text-danger text-sm mb-4" role="status">
              {d.noLocationWarning}
            </p>
          )}

          {project.location && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div>
                <p className="text-xs text-fg-muted uppercase tracking-wide">{d.address}</p>
                <p className="text-sm text-fg mt-2">{project.location.addressLine}</p>
              </div>
              <div>
                <p className="text-xs text-fg-muted uppercase tracking-wide">{d.coordinates}</p>
                <p className="mt-2">
                  <span className="gts-num gts-num-sm">
                    {project.location.latitude.toString()}, {project.location.longitude.toString()}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-fg-muted uppercase tracking-wide">{d.checkInRadius}</p>
                <p className="mt-2">
                  <span className="gts-num gts-num-md">{project.location.radiusMetres}</span>
                  <span className="gts-num-currency">m</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-fg-muted uppercase tracking-wide">{d.navigate}</p>
                <p className="mt-2">
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
                    className="h-touch px-3 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center gap-2"
                  >
                    <Icon name="map" size={18} />
                    {d.openInMaps}
                  </a>
                </p>
              </div>
            </div>
          )}

          {can(actor, 'projects.location') ? (
            <LocationForm
              projectId={project.id}
              dict={dict.operations.projects.location}
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
                {d.pinPermissionHint}
              </p>
            )
          )}
        </section>

        {/* ---------- The team ---------- */}
        <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">{`${d.teamTitle} (${live.length})`}</h2>

          {can(actor, 'projects.assign') && (
            <AssignForm
              projectId={project.id}
              candidates={candidates}
              hasLocation={Boolean(project.location)}
              dict={dict.operations.projects.assign}
            />
          )}

          {project.employees.length === 0 ? (
            <Empty
              title={d.emptyTeamTitle}
              body={d.emptyTeamBody}
            />
          ) : (
            <div className="gts-table-scroll mt-4">
              <table className="gts-table gts-table-comfortable">
                <thead>
                  <tr>
                    <th scope="col">{d.colEmployee}</th>
                    <th scope="col">{d.colRoleOnSite}</th>
                    <th scope="col">{d.colAssigned}</th>
                    <th scope="col">{d.colToday}</th>
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
                          {formatDate(assignment.assignedOn.toISOString(), locale)}
                          {assignment.releasedOn && (
                            <span className="gts-meta gts-cell-sub">
                              {d.released} {formatDate(assignment.releasedOn.toISOString(), locale)}
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
                            <span className="gts-meta">{d.notIn}</span>
                          )}
                        </td>
                        {can(actor, 'projects.assign') && (
                          <td>
                            {!assignment.releasedOn && (
                              <ReleaseButton
                                assignmentId={assignment.id}
                                projectId={project.id}
                                name={assignment.employee.nameEn}
                                dict={dict.operations.projects.assign}
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
        </section>

        {/* ---------- Materials ---------- */}
        {can(actor, 'inventory.view') && (
          <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
            <h2 className="text-lg font-semibold text-fg mb-4">{d.materialsTitle}</h2>

            {canMoveStock && (
              <AllocateForm
                projectId={project.id}
                products={stockOptions}
                closed={closed}
                dict={dict.operations.projects.materials}
              />
            )}

            {project.products.length === 0 ? (
              <Empty
                title={d.emptyMaterialsTitle}
                body={d.emptyMaterialsBody}
              />
            ) : (
              <div className="gts-table-scroll mt-4">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">{d.colProduct}</th>
                      <th scope="col" className="gts-cell-num">{d.colAllocated}</th>
                      <th scope="col" className="gts-cell-num">{d.colDelivered}</th>
                      <th scope="col" className="gts-cell-num">{d.colReturned}</th>
                      <th scope="col" className="gts-cell-num">{d.colDamaged}</th>
                      <th scope="col" className="gts-cell-num">{d.colInTransit}</th>
                      <th scope="col" className="gts-cell-num">{d.colOnSite}</th>
                      <th scope="col" className="gts-cell-num">{d.colTotalPrice}</th>
                      {canMoveStock && <th scope="col" />}
                    </tr>
                  </thead>
                  <tbody>
                    {project.products.map((row) => {
                      const unitPrice = (row.agreedPrice ?? row.product.salePrice).toNumber();
                      const totalPrice = row.position.remaining.toNumber() * unitPrice;
                      return (
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
                          <td className="gts-cell-num">
                            <TotalOnSitePrice
                              projectId={project.id}
                              productId={row.product.id}
                              productName={row.product.nameEn}
                              unit={row.product.unit}
                              totalPrice={totalPrice}
                              inTransit={row.position.inTransit.toString()}
                              onSite={row.position.remaining.toString()}
                              warehouses={warehouses}
                              canMoveStock={canMoveStock}
                              locale={locale}
                              dict={dict.operations.projects.materials}
                            />
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
                                dict={dict.operations.projects.materials}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---------- Financials ---------- */}
        {financials && (
          <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
            <h2 className="text-lg font-semibold text-fg mb-4">{d.financialTitle}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Figure label={d.figureBudget} value={financials.budget?.toNumber() ?? null} notSet={d.notSet} locale={locale} />
              <Figure label={d.figureBilled} value={financials.billed.toNumber()} notSet={d.notSet} locale={locale} />
              <Figure label={d.figureCollected} value={financials.collected.toNumber()} notSet={d.notSet} locale={locale} />
              <Figure
                label={d.figureOutstanding}
                value={financials.outstanding.toNumber()}
                tone={financials.outstanding.greaterThan(0) ? 'warning' : undefined}
                notSet={d.notSet}
                locale={locale}
              />
              <Figure label={d.figureMaterialsOnSite} value={
                financials.materialsAllocated.minus(financials.materialsReturned).toNumber()
              } notSet={d.notSet} locale={locale} />
              <Figure label={d.figureLabourToDate} value={financials.labourCost.toNumber()} notSet={d.notSet} locale={locale} />
            </div>
            {financials.remainingBudget && (
              <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
                {financials.remainingBudget.isNegative() ? d.overBudgetBy : d.budgetRemaining}
                <Amount value={Math.abs(financials.remainingBudget.toNumber())} size="sm" currency={null} locale={locale} />
                {' · '}
                {financials.attendanceDays} {financials.attendanceDays === 1 ? d.attendanceDay_one : d.attendanceDay_other}
              </p>
            )}
          </section>
        )}
      </main>
    </Shell>
  );
}

function Figure({
  label,
  value,
  tone,
  notSet,
  locale,
}: {
  label: string;
  value: number | null;
  tone?: 'danger' | 'warning';
  notSet: string;
  locale: 'en' | 'ar';
}) {
  return (
    <div className="bg-inset rounded-lg border border-line p-4 min-w-0">
      <p className="text-xs text-fg-muted uppercase tracking-wide truncate">{label}</p>
      <p className={`mt-2 min-w-0 gts-num-fit ${tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : ''}`}>
        {value === null ? (
          <span className="gts-meta">{notSet}</span>
        ) : (
          <Amount value={value} size="md" locale={locale} />
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
