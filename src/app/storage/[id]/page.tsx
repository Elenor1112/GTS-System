import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { warehouseDetail } from '@/lib/services/catalogue';
import { GOVERNORATES } from '@/lib/egypt';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

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

/**
 * WAREHOUSE — what is in this building, and how it got there.
 *
 * Two halves, in the order the questions are actually asked: the stock
 * standing on the floor now, then the ledger rows that produced it.
 *
 * Nothing here is editable except the warehouse's own details. Stock
 * moves by receiving, issuing, transferring or adjusting — each of which
 * appends a row to the ledger — so a screen that let someone type a new
 * quantity would be writing a number the ledger could not explain.
 */
export default async function WarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('warehouses.view');
  const { id } = await params;

  const [warehouse, dict, locale] = await Promise.all([warehouseDetail(id), t(), getLocale()]);
  if (!warehouse) notFound();
  const d = dict.catalogue.warehouses.detail;
  const txLabel = dict.catalogue.txLabel as Record<string, string>;

  const governorate = warehouse.governorateCode
    ? GOVERNORATES.find((g) => g.code === warehouse.governorateCode)?.en
    : null;

  // Cost is money. Someone who may see the building need not be someone
  // who may see what is standing in it.
  const seesMoney = can(actor, 'accounts.view');

  const totalUnits = warehouse.stock.reduce((sum, s) => sum + s.quantity.toNumber(), 0);
  const reservedUnits = warehouse.stock.reduce((sum, s) => sum + s.reserved.toNumber(), 0);

  return (
    <Shell active="/storage" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline={`Warehouse · ${warehouse.code}`}
          title={warehouse.nameEn}
          lede={
            [governorate, warehouse.addressLine].filter(Boolean).join(' · ') ||
            d.noAddress
          }
          actions={
            <>
              {warehouse.latitude && warehouse.longitude && (
                <a
                  href={`https://www.google.com/maps/@${warehouse.latitude},${warehouse.longitude},17z`}
                  target="_blank"
                  rel="noreferrer"
                  className="gts-btn gts-btn-secondary"
                >
                  {d.openInMaps}
                </a>
              )}
              {can(actor, 'warehouses.manage') && (
                <a href={`/storage/${warehouse.id}/edit`} className="gts-btn gts-btn-primary">
                  {d.edit}
                </a>
              )}
              <a href={`/storage/${warehouse.id}/print`} className="gts-btn gts-btn-secondary">
                {d.print}
              </a>
            </>
          }
        />

        {!warehouse.isActive && (
          <p className="gts-meta" style={{ marginBlockEnd: 'var(--gts-space-5)' }}>
            <Status tone="neutral">{dict.common.inactive}</Status> {d.inactiveNotice}
          </p>
        )}

        <div className="gts-stat-row">
          <div className="gts-stat">
            <p className="gts-overline">{d.products}</p>
            <p className="gts-stat-value">
              <span className="gts-num gts-num-md">{warehouse.stock.length}</span>
            </p>
          </div>
          <div className="gts-stat">
            <p className="gts-overline">{d.unitsOnHand}</p>
            <p className="gts-stat-value">
              <span className="gts-num gts-num-md">{totalUnits.toLocaleString('en-US')}</span>
            </p>
          </div>
          {reservedUnits > 0 && (
            <div className="gts-stat">
              <p className="gts-overline">{d.reserved}</p>
              <p className="gts-stat-value">
                <span className="gts-num gts-num-md">{reservedUnits.toLocaleString('en-US')}</span>
              </p>
            </div>
          )}
          {seesMoney && (
            <div className="gts-stat">
              <p className="gts-overline">{d.valueAtCost}</p>
              <p className="gts-stat-value">
                <Amount value={warehouse.valueAtCost.toNumber()} size="md" locale={locale} />
              </p>
            </div>
          )}
          {warehouse.capacityM3 && (
            <div className="gts-stat">
              <p className="gts-overline">{d.capacity}</p>
              <p className="gts-stat-value">
                <span className="gts-num gts-num-md">
                  {warehouse.capacityM3.toString()}
                </span>{' '}
                m³
              </p>
            </div>
          )}
        </div>

        {/* ---------- STOCK ON HAND ---------- */}
        <section style={{ marginBlockStart: 'var(--gts-space-7)' }}>
          <h2 className="gts-overline">{d.stockOnHand}</h2>

          {warehouse.stock.length === 0 ? (
            <Empty
              title={d.emptyStockTitle}
              body={d.emptyStockBody}
            />
          ) : (
            <table className="gts-table">
              <thead>
                <tr>
                  <th scope="col">{d.colSku}</th>
                  <th scope="col">{d.colProduct}</th>
                  <th scope="col">{d.colBin}</th>
                  <th scope="col" className="gts-cell-num">{d.colQuantity}</th>
                  <th scope="col" className="gts-cell-num">{d.colReserved}</th>
                  <th scope="col" className="gts-cell-num">{d.colAvailable}</th>
                  {seesMoney && <th scope="col" className="gts-cell-num">{d.colValueAtCost}</th>}
                </tr>
              </thead>
              <tbody>
                {warehouse.stock.map((line) => {
                  const quantity = line.quantity.toNumber();
                  const reserved = line.reserved.toNumber();
                  // Available is what someone can actually take today:
                  // reserved units are physically present but already
                  // committed to a project allocation.
                  const available = quantity - reserved;
                  const low =
                    line.product.reorderLevel != null &&
                    quantity <= line.product.reorderLevel.toNumber();

                  return (
                    <tr key={line.id}>
                      {/* Plain text, not a link: /products/[id] does
                          not exist yet. Linking to it would add another
                          404 of exactly the kind this page was written
                          to remove. */}
                      <td>{line.product.sku}</td>
                      <td>
                        {line.product.nameEn}
                        {low && (
                          <>
                            {' '}
                            <Status tone="warning">{d.low}</Status>
                          </>
                        )}
                      </td>
                      <td>{line.binLocation ?? '—'}</td>
                      <td className="gts-cell-num">
                        <span className="gts-num">{line.quantity.toString()}</span>{' '}
                        {line.product.unit}
                      </td>
                      <td className="gts-cell-num">
                        <span className="gts-num">{reserved > 0 ? line.reserved.toString() : '—'}</span>
                      </td>
                      <td className="gts-cell-num">
                        <span className="gts-num">{available.toLocaleString('en-US')}</span>
                      </td>
                      {seesMoney && (
                        <td className="gts-cell-num">
                          <Amount value={quantity * line.product.costPrice.toNumber()} locale={locale} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* ---------- THE LEDGER ---------- */}
        <section style={{ marginBlockStart: 'var(--gts-space-7)' }}>
          <h2 className="gts-overline">{d.recentMovements}</h2>

          {warehouse.movements.length === 0 ? (
            <Empty
              title={d.emptyMovementsTitle}
              body={d.emptyMovementsBody}
            />
          ) : (
            <table className="gts-table">
              <thead>
                <tr>
                  <th scope="col">{d.colDate}</th>
                  <th scope="col">{d.colReference}</th>
                  <th scope="col">{d.colType}</th>
                  <th scope="col">{d.colProduct2}</th>
                  <th scope="col" className="gts-cell-num">{d.colQuantity}</th>
                  <th scope="col" className="gts-cell-num">{d.colBalanceAfter}</th>
                  <th scope="col">{d.colBy}</th>
                </tr>
              </thead>
              <tbody>
                {warehouse.movements.map((tx) => {
                  const quantity = tx.quantity.toNumber();
                  return (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.occurredAt.toISOString(), locale)}</td>
                      <td>{tx.ref}</td>
                      <td>
                        {txLabel[tx.type] ?? tx.type}
                        {/* A transfer is two rows; naming the other end
                            is what makes this one readable in isolation. */}
                        {tx.destinationWarehouse && ` → ${tx.destinationWarehouse.code}`}
                        {tx.project && ` · ${tx.project.code}`}
                      </td>
                      <td>{tx.product.nameEn}</td>
                      <td className="gts-cell-num">
                        {/* Signed against this warehouse: the sign is the
                            direction, so it is shown rather than stripped. */}
                        <span className="gts-num">
                          {quantity > 0 ? `+${tx.quantity.toString()}` : tx.quantity.toString()}
                        </span>{' '}
                        {tx.product.unit}
                      </td>
                      <td className="gts-cell-num">
                        <span className="gts-num">{tx.balanceAfter.toString()}</span>
                      </td>
                      <td>{tx.performedBy.nameEn}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </Shell>
  );
}
