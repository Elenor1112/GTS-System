import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { organisation } from '@/lib/services/settings';
import { warehouseDetail } from '@/lib/services/catalogue';
import { GOVERNORATES } from '@/lib/egypt';
import { formatDate } from '@/lib/format';
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
  const warehouse = await warehouseDetail(id);
  return { title: warehouse ? `${warehouse.nameEn} — GTS` : 'Warehouse — GTS' };
}

/** THE PRINTABLE WAREHOUSE SHEET — stock on the floor, then the ledger. */
export default async function WarehousePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('warehouses.view');
  const { id } = await params;

  const [warehouse, org, dict, locale] = await Promise.all([
    warehouseDetail(id),
    organisation(),
    t(),
    getLocale(),
  ]);
  if (!warehouse) notFound();
  const d = dict.catalogue.warehouses.print;
  const txLabel = dict.catalogue.txLabel as Record<string, string>;

  const governorate = warehouse.governorateCode
    ? GOVERNORATES.find((g) => g.code === warehouse.governorateCode)?.en
    : null;
  const seesMoney = can(actor, 'accounts.view');

  return (
    <main className="gts-page" style={{ maxInlineSize: '52rem', margin: '0 auto', padding: '2rem' }}>
      <AutoPrint />

      <div className="gts-no-print" style={{ marginBlockEnd: '2rem', display: 'flex', gap: '0.5rem' }}>
        <a href={`/storage/${warehouse.id}`} className="gts-btn gts-btn-secondary">
          {d.backToWarehouse}
        </a>
      </div>

      <header style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline">{d.sheetOverline}</p>
        <h1 className="gts-display" style={{ marginBlockStart: '0.25rem' }}>{warehouse.nameEn}</h1>
        <p className="gts-meta">
          {warehouse.code} · {[governorate, warehouse.addressLine].filter(Boolean).join(' · ') || org.nameEn}
        </p>
      </header>

      <section style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline" style={{ marginBlockEnd: '0.5rem' }}>{d.stockOnFloor}</p>
        {warehouse.stock.length === 0 ? (
          <p className="gts-meta">{d.nothingStocked}</p>
        ) : (
          <table className="gts-table">
            <thead>
              <tr>
                <th scope="col">{d.colProduct}</th>
                <th scope="col">{d.colBin}</th>
                <th scope="col" className="gts-cell-num">{d.colQuantity}</th>
                <th scope="col" className="gts-cell-num">{d.colReserved}</th>
                {seesMoney && <th scope="col" className="gts-cell-num">{d.colValueAtCost}</th>}
              </tr>
            </thead>
            <tbody>
              {warehouse.stock.map((row) => (
                <tr key={row.id}>
                  <td><bdi>{row.product.sku}</bdi> — {row.product.nameEn}</td>
                  <td>{row.binLocation ?? <span className="gts-meta">—</span>}</td>
                  <td className="gts-cell-num"><span className="gts-num">{row.quantity.toString()}</span></td>
                  <td className="gts-cell-num"><span className="gts-num">{row.reserved.toString()}</span></td>
                  {seesMoney && (
                    <td className="gts-cell-num">
                      <span className="gts-num">
                        {row.quantity.times(row.product.costPrice).toDecimalPlaces(2).toString()}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <p className="gts-overline" style={{ marginBlockEnd: '0.5rem' }}>{d.recentMovements}</p>
        {warehouse.movements.length === 0 ? (
          <p className="gts-meta">{d.noMovements}</p>
        ) : (
          <table className="gts-table">
            <thead>
              <tr>
                <th scope="col">{d.colDate}</th>
                <th scope="col">{d.colRef}</th>
                <th scope="col">{d.colType}</th>
                <th scope="col">{d.colProduct2}</th>
                <th scope="col" className="gts-cell-num">{d.colQty}</th>
              </tr>
            </thead>
            <tbody>
              {warehouse.movements.map((tx) => (
                <tr key={tx.id}>
                  <td>{formatDate(tx.occurredAt.toISOString(), locale)}</td>
                  <td>{tx.ref}</td>
                  <td>
                    {txLabel[tx.type] ?? tx.type}
                    {tx.destinationWarehouse && ` → ${tx.destinationWarehouse.code}`}
                    {tx.project && ` · ${tx.project.code}`}
                  </td>
                  <td><bdi>{tx.product.sku}</bdi> — {tx.product.nameEn}</td>
                  <td className="gts-cell-num">
                    <span className="gts-num">
                      {tx.quantity.toNumber() > 0 ? `+${tx.quantity.toString()}` : tx.quantity.toString()}
                    </span>
                  </td>
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
