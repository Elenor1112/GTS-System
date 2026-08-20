import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listProducts, listCategories } from '@/lib/services/catalogue';

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
  searchParams: Promise<{ q?: string; category?: string; low?: string }>;
}) {
  const actor = await requirePermission('products.view');
  const params = await searchParams;

  const lowOnly = params.low === '1';
  const [products, categories] = await Promise.all([
    listProducts({
      search: params.q,
      categoryId: params.category || undefined,
      lowStockOnly: lowOnly,
    }),
    listCategories(),
  ]);

  const lowCount = products.filter((p) => p.isLow).length;
  const seesCost = can(actor, 'accounts.view') || can(actor, 'inventory.manage');

  return (
    <Shell active="/products" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline="Catalogue"
          title="Products"
          lede={`${products.length} product${products.length === 1 ? '' : 's'}${
            lowCount > 0 && !lowOnly ? ` · ${lowCount} at or below the reorder level` : ''
          }`}
          actions={
            can(actor, 'products.create') ? (
              <a href="/products/new" className="gts-btn gts-btn-accent">
                New product
              </a>
            ) : undefined
          }
        />

        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 16rem' }}>
            <label className="gts-sr" htmlFor="q">
              Search products
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Name, SKU or brand"
              className="gts-input"
            />
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={params.category ?? ''}
              className="gts-input gts-select"
            >
              <option value="">Any category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn} ({c._count.products})
                </option>
              ))}
            </select>
          </div>
          <label className="gts-check">
            <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} />
            Only low stock
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            Filter
          </button>
          {(params.q || params.category || lowOnly) && (
            <a href="/products" className="gts-btn gts-btn-ghost">
              Clear
            </a>
          )}
        </form>

        {products.length === 0 ? (
          <Empty
            title={
              lowOnly
                ? 'Nothing is below its reorder level'
                : params.q || params.category
                  ? 'No product matches'
                  : 'No products yet'
            }
            body={
              lowOnly
                ? 'Every product with a reorder level set is above it.'
                : params.q || params.category
                  ? 'Try a different search, or clear the filter.'
                  : 'A product is what you receive into a warehouse, allocate to a project and put on a bill.'
            }
            filtered={Boolean(params.q || params.category || lowOnly)}
            action={
              can(actor, 'products.create') && !params.q && !lowOnly ? (
                <a href="/products/new" className="gts-btn gts-btn-accent">
                  New product
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">The product catalogue with stock on hand</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Vendor</th>
                  {seesCost && <th scope="col" className="gts-cell-num">Cost</th>}
                  <th scope="col" className="gts-cell-num">Sale</th>
                  <th scope="col" className="gts-cell-num">On hand</th>
                  <th scope="col" className="gts-cell-num">Free</th>
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
                        <span className="gts-meta gts-cell-sub">{product.marginPct}% margin</span>
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
                          reorder at {product.reorderLevel.toString()}
                        </span>
                      )}
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num gts-num-sm">{product.free.toString()}</span>
                      {product.reserved.greaterThan(0) && (
                        <span className="gts-meta gts-cell-sub">
                          {product.reserved.toString()} reserved
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
