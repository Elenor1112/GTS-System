import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth';
import { organisation } from '@/lib/services/settings';
import { productDetail } from '@/lib/services/catalogue';
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
  const product = await productDetail(id);
  return { title: product ? `${product.nameEn} — GTS` : 'Product — GTS' };
}

/**
 * THE PRINTABLE PRODUCT SHEET.
 *
 * Stock per warehouse, then the movement history — the same two
 * questions the on-screen product page leads with: where is it standing,
 * and where has it been.
 */
export default async function ProductPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('products.view');
  const { id } = await params;

  const [product, org, dict, locale] = await Promise.all([
    productDetail(id),
    organisation(),
    t(),
    getLocale(),
  ]);
  if (!product) notFound();
  const d = dict.catalogue.products.print;
  const txLabel = dict.catalogue.txLabel as Record<string, string>;

  return (
    <main className="gts-page" style={{ maxInlineSize: '52rem', margin: '0 auto', padding: '2rem' }}>
      <AutoPrint />

      <div className="gts-no-print" style={{ marginBlockEnd: '2rem', display: 'flex', gap: '0.5rem' }}>
        <a href={`/products/${product.id}`} className="gts-btn gts-btn-secondary">
          {d.backToProduct}
        </a>
      </div>

      <header style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline">{d.sheetOverline}</p>
        <h1 className="gts-display" style={{ marginBlockStart: '0.25rem' }}>{product.nameEn}</h1>
        <p className="gts-meta"><bdi>{product.sku}</bdi> · {org.nameEn}</p>
      </header>

      <section style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline" style={{ marginBlockEnd: '0.5rem' }}>{d.stockByWarehouse}</p>
        {product.stock.length === 0 ? (
          <p className="gts-meta">{d.noStock}</p>
        ) : (
          <table className="gts-table">
            <thead>
              <tr>
                <th scope="col">{d.colWarehouse}</th>
                <th scope="col">{d.colBin}</th>
                <th scope="col" className="gts-cell-num">{d.colQuantity}</th>
                <th scope="col" className="gts-cell-num">{d.colReserved}</th>
              </tr>
            </thead>
            <tbody>
              {product.stock.map((row) => (
                <tr key={row.id}>
                  <td>{row.warehouse.code} — {row.warehouse.nameEn}</td>
                  <td>{row.binLocation ?? <span className="gts-meta">—</span>}</td>
                  <td className="gts-cell-num"><span className="gts-num">{row.quantity.toString()}</span></td>
                  <td className="gts-cell-num"><span className="gts-num">{row.reserved.toString()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <p className="gts-overline" style={{ marginBlockEnd: '0.5rem' }}>{d.movementHistory}</p>
        {product.movements.length === 0 ? (
          <p className="gts-meta">{d.noMovements}</p>
        ) : (
          <table className="gts-table">
            <thead>
              <tr>
                <th scope="col">{d.colDate}</th>
                <th scope="col">{d.colRef}</th>
                <th scope="col">{d.colType}</th>
                <th scope="col">{d.colWarehouse2}</th>
                <th scope="col" className="gts-cell-num">{d.colQty}</th>
                <th scope="col" className="gts-cell-num">{d.colBalance}</th>
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
                    <span className="gts-num">
                      {tx.quantity.toNumber() > 0 ? `+${tx.quantity.toString()}` : tx.quantity.toString()}
                    </span>
                  </td>
                  <td className="gts-cell-num"><span className="gts-num">{tx.balanceAfter.toString()}</span></td>
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
