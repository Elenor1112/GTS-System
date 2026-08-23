import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listProducts, listCategories, listWarehouses } from '@/lib/services/catalogue';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Products — GTS' };
export const dynamic = 'force-dynamic';

/**
 * PRODUCTS — the catalogue.
 *
 * The stock figure is a sum across every warehouse, computed from the
 * `warehouse_stock` projection that the ledger maintains. A product at
 * or below its reorder level is flagged here, which is the same
 * condition that raises the dashboard alert — one rule, two surfaces.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; warehouse?: string; low?: string }>;
}) {
  const actor = await requirePermission('products.view');
  const params = await searchParams;
  const dict = await t();
  const d = dict.catalogue.products.list;

  const lowOnly = params.low === '1';
  const [products, categories, warehouses] = await Promise.all([
    listProducts({
      search: params.q,
      categoryId: params.category || undefined,
      warehouseId: params.warehouse || undefined,
      lowStockOnly: lowOnly,
    }),
    listCategories(),
    listWarehouses(),
  ]);

  const lowCount = products.filter((p) => p.isLow).length;
  const seesCost = can(actor, 'accounts.view') || can(actor, 'inventory.manage');

  return (
    <Shell active="/products" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={`${products.length} ${products.length === 1 ? d.countOne : d.countOther}${
            lowCount > 0 && !lowOnly ? ` · ${lowCount} ${d.lowSuffix}` : ''
          }`}
          actions={
            can(actor, 'products.create') ? (
              <a href="/products/new" className="gts-btn gts-btn-accent">
                {d.newProduct}
              </a>
            ) : undefined
          }
        />

        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 16rem' }}>
            <label className="gts-sr" htmlFor="q">
              {d.searchLabel}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder={d.searchPlaceholder}
              className="gts-input"
            />
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="category">
              {d.categoryLabel}
            </label>
            <select
              id="category"
              name="category"
              defaultValue={params.category ?? ''}
              className="gts-input gts-select"
            >
              <option value="">{d.anyCategory}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn} ({c._count.products})
                </option>
              ))}
            </select>
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="warehouse">
              {d.warehouseLabel}
            </label>
            <select
              id="warehouse"
              name="warehouse"
              defaultValue={params.warehouse ?? ''}
              className="gts-input gts-select"
            >
              <option value="">{d.anyWarehouse}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.nameEn}
                </option>
              ))}
            </select>
          </div>
          <label className="gts-check">
            <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} />
            {d.onlyLowStock}
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            {d.filter}
          </button>
          {(params.q || params.category || params.warehouse || lowOnly) && (
            <a href="/products" className="gts-btn gts-btn-ghost">
              {d.clear}
            </a>
          )}
        </form>

        {products.length === 0 ? (
          <Empty
            title={
              lowOnly
                ? d.emptyLowTitle
                : params.q || params.category || params.warehouse
                  ? d.emptyFilteredTitle
                  : d.emptyTitle
            }
            body={
              lowOnly
                ? d.emptyLowBody
                : params.q || params.category || params.warehouse
                  ? d.emptyFilteredBody
                  : d.emptyBody
            }
            filtered={Boolean(params.q || params.category || params.warehouse || lowOnly)}
            action={
              can(actor, 'products.create') && !params.q && !lowOnly ? (
                <a href="/products/new" className="gts-btn gts-btn-accent">
                  {d.newProduct}
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">{d.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{d.colProduct}</th>
                  <th scope="col">{d.colCategory}</th>
                  <th scope="col">{d.colVendor}</th>
                  {seesCost && <th scope="col" className="gts-cell-num">{d.colCost}</th>}
                  <th scope="col" className="gts-cell-num">{d.colSale}</th>
                  <th scope="col" className="gts-cell-num">{d.colOnHand}</th>
                  <th scope="col" className="gts-cell-num">{d.colFree}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <th scope="row">
                      <a href={`/products/${product.id}`} className="gts-cell-link">
                        {product.nameEn}
                      </a>
                      <span className="gts-meta gts-cell-sub">
                        <bdi>{product.sku}</bdi> · {product.unit}
                        {product.brand && ` · ${product.brand}`}
                      </span>
                    </th>
                    <td>{product.category?.nameEn ?? <span className="gts-meta">—</span>}</td>
                    <td>
                      {product.vendor ? (
                        <a href={`/vendors/${product.vendor.id}`} className="gts-cell-link">
                          {product.vendor.nameEn}
                        </a>
                      ) : (
                        <span className="gts-meta">—</span>
                      )}
                    </td>
                    {seesCost && (
                      <td className="gts-cell-num">
                        <Amount value={product.costPrice.toNumber()} size="sm" currency={null} />
                      </td>
                    )}
                    <td className="gts-cell-num">
                      <Amount value={product.salePrice.toNumber()} size="sm" currency={null} />
                      {product.marginPct !== null && (
                        <span className="gts-meta gts-cell-sub">{product.marginPct}{d.marginSuffix}</span>
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {product.isLow ? (
                        <Status tone="warning">{product.onHand.toString()}</Status>
                      ) : (
                        <span className="gts-num gts-num-sm">{product.onHand.toString()}</span>
                      )}
                      {product.reorderLevel.greaterThan(0) && (
                        <span className="gts-meta gts-cell-sub">
                          {d.reorderAtPrefix} {product.reorderLevel.toString()}
                        </span>
                      )}
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num gts-num-sm">{product.free.toString()}</span>
                      {product.reserved.greaterThan(0) && (
                        <span className="gts-meta gts-cell-sub">
                          {product.reserved.toString()} {d.reservedSuffix}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
