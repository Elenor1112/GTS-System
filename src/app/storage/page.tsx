import type { Metadata } from 'next';

import { Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listWarehouses } from '@/lib/services/catalogue';
import { GOVERNORATES } from '@/lib/egypt';
import { t } from '@/lib/i18n';

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
  const [warehouses, dict] = await Promise.all([listWarehouses(), t()]);
  const d = dict.catalogue.warehouses.list;

  const governorate = (code: number | null) =>
    code ? GOVERNORATES.find((g) => g.code === code)?.en ?? null : null;

  const totalUnits = warehouses.reduce((sum, w) => sum + w.totalUnits.toNumber(), 0);

  return (
    <Shell active="/storage" domain="inventory">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={`${warehouses.length} ${warehouses.length === 1 ? d.countOne : d.countOther}${
            totalUnits > 0 ? ` · ${totalUnits.toLocaleString('en-US')} ${d.unitsSuffix}` : ''
          }`}
          actions={
            can(actor, 'warehouses.manage') ? (
              <a
                href="/storage/new"
                className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Icon name="add" />
                {d.newWarehouse}
              </a>
            ) : undefined
          }
        />

        {warehouses.length === 0 ? (
          <div className="bg-surface rounded-lg border border-line shadow-raised">
            <Empty
              title={d.emptyTitle}
              body={d.emptyBody}
              action={
                can(actor, 'warehouses.manage') ? (
                  <a
                    href="/storage/new"
                    className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    <Icon name="add" />
                    {d.newWarehouse}
                  </a>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {warehouses.map((warehouse) => (
              <article key={warehouse.id} className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 pt-6">
                  <span className="text-xs text-fg-muted uppercase tracking-wide">{warehouse.code}</span>
                  {!warehouse.isActive && <Status tone="neutral">{dict.common.inactive}</Status>}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <a href={`/storage/${warehouse.id}`} className="text-lg font-semibold text-fg hover:text-brand-fg transition-colors">
                    {warehouse.nameEn}
                  </a>
                  <p className="text-sm text-fg-secondary mt-2">
                    {[governorate(warehouse.governorateCode), warehouse.addressLine]
                      .filter(Boolean)
                      .join(' · ') || d.noAddress}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mt-5">
                    <div>
                      <p className="text-xs text-fg-muted uppercase tracking-wide">{d.colProducts}</p>
                      <p className="text-xl font-semibold text-fg mt-1">{warehouse.distinctProducts}</p>
                    </div>
                    <div>
                      <p className="text-xs text-fg-muted uppercase tracking-wide">{d.colUnits}</p>
                      <p className="text-xl font-semibold text-fg mt-1">{warehouse.totalUnits.toString()}</p>
                    </div>
                  </div>

                  {warehouse.reservedUnits.greaterThan(0) && (
                    <p className="text-xs text-fg-secondary mt-3">
                      {warehouse.reservedUnits.toString()} {d.reservedForProjects}
                    </p>
                  )}

                  {warehouse.latitude && warehouse.longitude && (
                    <a
                      href={`https://www.google.com/maps/@${warehouse.latitude},${warehouse.longitude},17z`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-auto pt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-fg hover:underline"
                    >
                      <Icon name="map" size={18} />
                      {d.openInMaps}
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
