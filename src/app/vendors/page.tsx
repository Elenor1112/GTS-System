import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listVendors } from '@/lib/services/vendors';
import { GOVERNORATES, TRN } from '@/lib/egypt';

export const metadata: Metadata = { title: 'Vendors — GTS' };
export const dynamic = 'force-dynamic';

/**
 * VENDORS — the supply side.
 *
 * The same table discipline as clients, reading the other way: what we
 * owe rather than what we are owed. Both figures are derived from bill
 * rows at query time, never from a stored balance.
 */
export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const actor = await requirePermission('vendors.view');
  const params = await searchParams;

  const includeArchived = params.archived === '1';
  const vendors = await listVendors({ search: params.q, includeArchived });

  const governorate = (code: number | null) =>
    code ? GOVERNORATES.find((g) => g.code === code)?.en ?? '—' : '—';

  const totalOwed = vendors.reduce((sum, v) => sum + v.outstanding.toNumber(), 0);
  const totalOverdue = vendors.reduce((sum, v) => sum + v.overdue.toNumber(), 0);

  return (
    <Shell active="/vendors" domain="vendors">
      <main className="gts-page">
        <PageHead
          overline="Supply"
          title="Vendors"
          lede={`${vendors.length} vendor${vendors.length === 1 ? '' : 's'}${
            totalOwed > 0
              ? ` · EGP ${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })} payable`
              : ''
          }`}
          actions={
            can(actor, 'vendors.create') ? (
              <a href="/vendors/new" className="gts-btn gts-btn-accent">
                New vendor
              </a>
            ) : undefined
          }
        />

        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 18rem' }}>
            <label className="gts-sr" htmlFor="q">
              Search vendors
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Name, code or tax number"
              className="gts-input"
            />
          </div>
          <label className="gts-check">
            <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} />
            Include archived
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            Search
          </button>
          {(params.q || includeArchived) && (
            <a href="/vendors" className="gts-btn gts-btn-ghost">
              Clear
            </a>
          )}
        </form>

        {vendors.length === 0 ? (
          <Empty
            title={params.q ? 'No vendor matches that search' : 'No vendors yet'}
            body={
              params.q
                ? 'Try a shorter search, or clear the filter.'
                : 'A vendor supplies the products you receive into your warehouses and bills you for them.'
            }
            filtered={Boolean(params.q)}
            action={
              can(actor, 'vendors.create') && !params.q ? (
                <a href="/vendors/new" className="gts-btn gts-btn-accent">
                  New vendor
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">Vendors and what is payable to each</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Tax number</th>
                  <th scope="col">Governorate</th>
                  <th scope="col" className="gts-cell-num">Products</th>
                  <th scope="col" className="gts-cell-num">Payable</th>
                  <th scope="col" className="gts-cell-num">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <th scope="row">
                      <a href={`/vendors/${vendor.id}`} className="gts-cell-link">
                        {vendor.nameEn}
                      </a>
                      <span className="gts-meta gts-cell-sub">
                        {vendor.code}
                        {!vendor.isActive && ' · archived'}
                      </span>
                    </th>
                    <td>
                      <bdi className="gts-num gts-num-sm">
                        {vendor.trn ? TRN.format(vendor.trn) : '—'}
                      </bdi>
                    </td>
                    <td>{governorate(vendor.governorateCode)}</td>
                    <td className="gts-cell-num">
                      <span className="gts-num gts-num-sm">{vendor.productCount}</span>
                    </td>
                    <td className="gts-cell-num">
                      {vendor.outstanding.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Amount value={vendor.outstanding.toNumber()} size="sm" currency={null} />
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {vendor.overdue.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Status tone="danger">
                          <Amount value={vendor.overdue.toNumber()} size="sm" currency={null} />
                        </Status>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totalOwed > 0 && (
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={4}>
                      Total
                    </th>
                    <td className="gts-cell-num">
                      <Amount value={totalOwed} size="sm" currency={null} />
                    </td>
                    <td className="gts-cell-num">
                      {totalOverdue > 0 ? (
                        <Amount value={totalOverdue} size="sm" currency={null} />
                      ) : (
                        <span className="gts-meta">—</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
