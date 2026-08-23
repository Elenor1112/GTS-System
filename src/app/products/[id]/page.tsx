import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { productDetail } from '@/lib/services/catalogue';
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
  const product = await productDetail(id);
  return { title: product ? `${product.nameEn} — GTS` : 'Product — GTS' };
}

/**
 * PRODUCT — one line of the catalogue, and where its units are.
 *
 * Three questions in the order they get asked: what is it, where is it
 * standing, and where has it been. The stock table is per warehouse
 * because "we have 400" is not an answer anyone can act on — the useful
 * fact is that 380 are in Cairo and 20 are in Alexandria.
 */
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('products.view');
  const { id } = await params;

  const [product, dict, locale] = await Promise.all([productDetail(id), t(), getLocale()]);
  if (!product) notFound();
  const d = dict.catalogue.products.detail;
  const txLabel = dict.catalogue.txLabel as Record<string, string>;

  const seesMoney = can(actor, 'accounts.view');

  const onHand = product.onHand.toNumber();
  const reserved = product.stock.reduce((sum, s) => sum + s.reserved.toNumber(), 0);
  const low = product.reorderLevel != null && onHand <= product.reorderLevel.toNumber();

  return (
    <Shell active="/products" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline={`Product · ${product.sku}`}
          title={product.nameEn}
          lede={
            [product.brand, product.category?.nameEn, `${d.counted} ${product.unit}`]
              .filter(Boolean)
              .join(' · ')
          }
          actions={
            <>
              {can(actor, 'products.edit') && (
                <a href={`/products/${product.id}/edit`} className="gts-btn gts-btn-primary">
                  {d.edit}
                </a>
              )}
              <a href={`/products/${product.id}/print`} className="gts-btn gts-btn-secondary">
                {d.print}
              </a>
            </>
          }
        />

        <div className="gts-stat-row">
          <div className="gts-stat">
            <p className="gts-overline">{d.onHand}</p>
            <p className="gts-stat-value">
              <span className="gts-num gts-num-md">{product.onHand.toString()}</span>{' '}
              {product.unit}
              {low && (
                <>
                  {' '}
                  <Status tone="warning">{d.low}</Status>
                </>
              )}
            </p>
          </div>
          {reserved > 0 && (
            <div className="gts-stat">
              <p className="gts-overline">{d.reserved}</p>
              <p className="gts-stat-value">
                <span className="gts-num gts-num-md">{reserved.toLocaleString('en-US')}</span>
              </p>
            </div>
          )}
          <div className="gts-stat">
            <p className="gts-overline">{d.reorderLevel}</p>
            <p className="gts-stat-value">
              <span className="gts-num gts-num-md">
                {product.reorderLevel?.toString() ?? '—'}
              </span>
            </p>
          </div>
          {seesMoney && (
            <>
              <div className="gts-stat">
                <p className="gts-overline">{d.costPrice}</p>
                <p className="gts-stat-value">
                  <Amount value={product.costPrice.toNumber()} size="md" locale={locale} />
                </p>
              </div>
              <div className="gts-stat">
                <p className="gts-overline">{d.salePrice}</p>
                <p className="gts-stat-value">
                  <Amount value={product.salePrice.toNumber()} size="md" locale={locale} />
                </p>
              </div>
              <div className="gts-stat">
                <p className="gts-overline">{d.valueAtCost}</p>
                <p className="gts-stat-value">
                  <Amount value={onHand * product.costPrice.toNumber()} size="md" locale={locale} />
                </p>
              </div>
            </>
          )}
          <div className="gts-stat">
            <p className="gts-overline">{d.vat}</p>
            <p className="gts-stat-value">
              <span className="gts-num gts-num-md">{product.vatRate.toString()}</span>%
            </p>
          </div>
        </div>

        {product.vendor && (
          <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
            {d.preferredVendor}{' '}
            <a href={`/vendors/${product.vendor.id}`} className="gts-cell-link">
              {product.vendor.code} — {product.vendor.nameEn}
            </a>
          </p>
        )}

        {/* ---------- WHERE IT IS ---------- */}
        <section style={{ marginBlockStart: 'var(--gts-space-7)' }}>
          <h2 className="gts-overline">{d.stockByWarehouse}</h2>

          {product.stock.length === 0 ? (
            <Empty
              title={d.emptyStockTitle}
              body={d.emptyStockBody}
            />
          ) : (
            <table className="gts-table">
              <thead>
                <tr>
                  <th scope="col">{d.colWarehouse}</th>
                  <th scope="col">{d.colBin}</th>
                  <th scope="col" className="gts-cell-num">{d.colQuantity}</th>
                  <th scope="col" className="gts-cell-num">{d.colReserved}</th>
                  <th scope="col" className="gts-cell-num">{d.colAvailable}</th>
                </tr>
              </thead>
              <tbody>
                {product.stock.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <a href={`/storage/${line.warehouse.id}`} className="gts-cell-link">
                        {line.warehouse.nameEn}
                      </a>
                    </td>
                    <td>{line.binLocation ?? '—'}</td>
                    <td className="gts-cell-num">
                      <span className="gts-num">{line.quantity.toString()}</span>
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num">
                        {line.reserved.toNumber() > 0 ? line.reserved.toString() : '—'}
                      </span>
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num">
                        {(line.quantity.toNumber() - line.reserved.toNumber()).toLocaleString('en-US')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ---------- COMMITTED TO PROJECTS ---------- */}
        {product.projectProducts.length > 0 && (
          <section style={{ marginBlockStart: 'var(--gts-space-7)' }}>
            <h2 className="gts-overline">{d.onProjects}</h2>
            <table className="gts-table">
              <thead>
                <tr>
                  <th scope="col">{d.colProject}</th>
                  <th scope="col" className="gts-cell-num">{d.colAllocated}</th>
                  <th scope="col" className="gts-cell-num">{d.colDelivered}</th>
                  <th scope="col" className="gts-cell-num">{d.colReturned}</th>
                  <th scope="col" className="gts-cell-num">{d.colDamaged}</th>
                </tr>
              </thead>
              <tbody>
                {product.projectProducts.map((pp) => (
                  <tr key={pp.id}>
                    <td>
                      <a href={`/projects/${pp.project.id}`} className="gts-cell-link">
                        {pp.project.code} — {pp.project.nameEn}
                      </a>
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num">{pp.allocated.toString()}</span>
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num">{pp.delivered.toString()}</span>
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num">{pp.returned.toString()}</span>
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num">{pp.damaged.toString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ---------- THE LEDGER ---------- */}
        <section style={{ marginBlockStart: 'var(--gts-space-7)' }}>
          <h2 className="gts-overline">{d.movementHistory}</h2>

          {product.movements.length === 0 ? (
            <Empty title={d.emptyMovementsTitle} body={d.emptyMovementsBody} />
          ) : (
            <table className="gts-table">
              <thead>
                <tr>
                  <th scope="col">{d.colDate}</th>
                  <th scope="col">{d.colReference}</th>
                  <th scope="col">{d.colType}</th>
                  <th scope="col">{d.colWarehouse}</th>
                  <th scope="col" className="gts-cell-num">{d.colQuantity}</th>
                  <th scope="col" className="gts-cell-num">{d.colBalanceAfter}</th>
                  <th scope="col">{d.colBy}</th>
                </tr>
              </thead>
              <tbody>
                {product.movements.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.occurredAt.toISOString(), locale)}</td>
                    <td>{tx.ref}</td>
                    <td>
                      {txLabel[tx.type] ?? tx.type}
                      {tx.destinationWarehouse && ` → ${tx.destinationWarehouse.code}`}
                      {tx.project && ` · ${tx.project.code}`}
                    </td>
                    <td>{tx.warehouse.code}</td>
                    <td className="gts-cell-num">
                      {/* The sign is the direction, so it is shown. */}
                      <span className="gts-num">
                        {tx.quantity.toNumber() > 0
                          ? `+${tx.quantity.toString()}`
                          : tx.quantity.toString()}
                      </span>
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num">{tx.balanceAfter.toString()}</span>
                    </td>
                    <td>{tx.performedBy.nameEn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </Shell>
  );
}
