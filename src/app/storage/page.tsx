import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listWarehouses } from '@/lib/services/catalogue';
import { GOVERNORATES } from '@/lib/egypt';

export const metadata: Metadata = { title: 'Storage — GTS' };
export const dynamic = 'force-dynamic';

/**
 * STORAGE — the warehouses.
 *
 * Every figure is derived from `warehouse_stock`, which the inventory
 * ledger maintains. Nothing on this screen can be edited directly:
 * stock changes by receiving, issuing, transferring or adjusting, each
 * of which writes a ledger row.
 */
export default async function StoragePage() {
  const actor = await requirePermission('warehouses.view');
  const warehouses = await listWarehouses();

  const governorate = (code: number | null) =>
    code ? GOVERNORATES.find((g) => g.code === code)?.en ?? null : null;

  const totalUnits = warehouses.reduce((sum, w) => sum + w.totalUnits.toNumber(), 0);

  return (
    <Shell active="/storage" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline="Operations"
          title="Storage"
          lede={`${warehouses.length} warehouse${warehouses.length === 1 ? '' : 's'}${
            totalUnits > 0 ? ` · ${totalUnits.toLocaleString('en-US')} units on hand` : ''
          }`}
          actions={
            can(actor, 'warehouses.manage') ? (
              <a href="/storage/new" className="gts-btn gts-btn-accent">
                New warehouse
              </a>
            ) : undefined
          }
        />

        {warehouses.length === 0 ? (
          <Empty
            title="No warehouses"
            body="A warehouse is where stock physically sits. Create one before receiving anything."
            action={
              can(actor, 'warehouses.manage') ? (
                <a href="/storage/new" className="gts-btn gts-btn-accent">
                  New warehouse
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="gts-grid-triptych">
            {warehouses.map((warehouse) => (
              <article key={warehouse.id} className="gts-panel">
                <div className="gts-panel-head">
                  <span className="gts-overline">{warehouse.code}</span>
                  {!warehouse.isActive && <Status tone="neutral">inactive</Status>}
                </div>
                <div className="gts-panel-body">
                  <a href={`/storage/${warehouse.id}`} className="gts-list-title">
                    {warehouse.nameEn}
                  </a>
                  <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
                    {[governorate(warehouse.governorateCode), warehouse.addressLine]
                      .filter(Boolean)
                      .join(' · ') || 'No address recorded'}
                  </p>

                  <div className="gts-stat-row" style={{ marginBlockStart: 'var(--gts-space-5)' }}>
                    <div className="gts-stat">
                      <p className="gts-overline">Products</p>
                      <p className="gts-stat-value">
                        <span className="gts-num gts-num-md">{warehouse.distinctProducts}</span>
                      </p>
                    </div>
                    <div className="gts-stat">
                      <p className="gts-overline">Units</p>
                      <p className="gts-stat-value">
                        <span className="gts-num gts-num-md">
                          {warehouse.totalUnits.toString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {warehouse.reservedUnits.greaterThan(0) && (
                    <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-3)' }}>
                      {warehouse.reservedUnits.toString()} reserved for project allocations
                    </p>
                  )}

                  {warehouse.latitude && warehouse.longitude && (
                    <a
                      href={`https://www.google.com/maps/@${warehouse.latitude},${warehouse.longitude},17z`}
                      target="_blank"
                      rel="noreferrer"
                      className="gts-btn gts-btn-ghost gts-btn-sm"
                      style={{ marginBlockStart: 'var(--gts-space-4)' }}
                    >
                      Open in Google Maps
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </Shell>
  );
}
