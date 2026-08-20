import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { warehouseDetail } from '@/lib/services/catalogue';
import { GOVERNORATES } from '@/lib/egypt';
import { formatDate } from '@/lib/format';

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

/** How each ledger row reads on screen. */
const TX_LABEL: Record<string, string> = {
  RECEIVE: 'Received',
  ISSUE: 'Issued',
  TRANSFER: 'Transfer',
  RETURN: 'Returned',
  DAMAGE: 'Damaged',
  ADJUSTMENT: 'Adjustment',
  PROJECT_ALLOCATION: 'Allocated',
};

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

  const warehouse = await warehouseDetail(id);
  if (!warehouse) notFound();

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
            'No address recorded'
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
                  Open in Google Maps
                </a>
              )}
              {can(actor, 'warehouses.manage') && (
                <a href={`/storage/${warehouse.id}/edit`} className="gts-btn gts-btn-primary">
                  Edit
                </a>
              )}
            </>
          }
        />

        {!warehouse.isActive && (
          <p className="gts-meta" style={{ marginBlockEnd: 'var(--gts-space-5)' }}>
            <Status tone="neutral">inactive</Status> This warehouse is no longer in use.
          </p>
        )}

        <div className="gts-stat-row">
          <div className="gts-stat">
            <p className="gts-overline">Products</p>
            <p className="gts-stat-value">
              <span className="gts-num gts-num-md">{warehouse.stock.length}</span>
            </p>
          </div>
          <div className="gts-stat">
            <p className="gts-overline">Units on hand</p>
            <p className="gts-stat-value">
              <span className="gts-num gts-num-md">{totalUnits.toLocaleString('en-US')}</span>
            </p>
          </div>
          {reservedUnits > 0 && (
            <div className="gts-stat">
              <p className="gts-overline">Reserved</p>
              <p className="gts-stat-value">
                <span className="gts-num gts-num-md">{reservedUnits.toLocaleString('en-US')}</span>
              </p>
            </div>
          )}
          {seesMoney && (
            <div className="gts-stat">
              <p className="gts-overline">Value at cost</p>
              <p className="gts-stat-value">
                <Amount value={warehouse.valueAtCost.toNumber()} size="md" />
              </p>
            </div>
          )}
          {warehouse.capacityM3 && (
            <div className="gts-stat">
              <p className="gts-overline">Capacity</p>
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
          <h2 className="gts-overline">Stock on hand</h2>

          {warehouse.stock.length === 0 ? (
            <Empty
              title="Nothing in stock"
              body="No product has been received into this warehouse yet, or everything received has since been issued."
            />
          ) : (
            <table className="gts-table">
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Product</th>
                  <th scope="col">Bin</th>
                  <th scope="col" className="gts-cell-num">Quantity</th>
                  <th scope="col" className="gts-cell-num">Reserved</th>
                  <th scope="col" className="gts-cell-num">Available</th>
                  {seesMoney && <th scope="col" className="gts-cell-num">Value at cost</th>}
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
                            <Status tone="warning">low</Status>
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
                          <Amount value={quantity * line.product.costPrice.toNumber()} />
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
          <h2 className="gts-overline">Recent movements</h2>

          {warehouse.movements.length === 0 ? (
            <Empty
              title="No movements"
              body="Nothing has moved through this warehouse yet."
            />
          ) : (
            <table className="gts-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Type</th>
                  <th scope="col">Product</th>
                  <th scope="col" className="gts-cell-num">Quantity</th>
                  <th scope="col" className="gts-cell-num">Balance after</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                {warehouse.movements.map((tx) => {
                  const quantity = tx.quantity.toNumber();
                  return (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.occurredAt.toISOString())}</td>
                      <td>{tx.ref}</td>
                      <td>
                        {TX_LABEL[tx.type] ?? tx.type}
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
