import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listVendors } from '@/lib/services/vendors';
import { GOVERNORATES, TRN } from '@/lib/egypt';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

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
  const [dict, locale] = await Promise.all([t(), getLocale()]);
  const d = dict.catalogue.vendors.list;

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
          overline={d.overline}
          title={d.title}
          lede={`${vendors.length} ${vendors.length === 1 ? d.countOne : d.countOther}${
            totalOwed > 0
              ? ` · EGP ${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${d.payableSuffix}`
              : ''
          }`}
          actions={
            can(actor, 'vendors.create') ? (
              <a href="/vendors/new" className="gts-btn gts-btn-accent">
                {d.newVendor}
              </a>
            ) : undefined
          }
        />

        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 18rem' }}>
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
          <label className="gts-check">
            <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} />
            {d.includeArchived}
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            {d.search}
          </button>
          {(params.q || includeArchived) && (
            <a href="/vendors" className="gts-btn gts-btn-ghost">
              {d.clear}
            </a>
          )}
        </form>

        {vendors.length === 0 ? (
          <Empty
            title={params.q ? d.emptySearchTitle : d.emptyTitle}
            body={
              params.q
                ? d.emptySearchBody
                : d.emptyBody
            }
            filtered={Boolean(params.q)}
            action={
              can(actor, 'vendors.create') && !params.q ? (
                <a href="/vendors/new" className="gts-btn gts-btn-accent">
                  {d.newVendor}
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
                  <th scope="col">{d.colVendor}</th>
                  <th scope="col">{d.colTaxNumber}</th>
                  <th scope="col">{d.colGovernorate}</th>
                  <th scope="col" className="gts-cell-num">{d.colProducts}</th>
                  <th scope="col" className="gts-cell-num">{d.colPayable}</th>
                  <th scope="col" className="gts-cell-num">{d.colOverdue}</th>
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
                        {!vendor.isActive && ` · ${d.archivedSuffix}`}
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
                        <Amount value={vendor.outstanding.toNumber()} size="sm" currency={null} locale={locale} />
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {vendor.overdue.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Status tone="danger">
                          <Amount value={vendor.overdue.toNumber()} size="sm" currency={null} locale={locale} />
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
                      {d.total}
                    </th>
                    <td className="gts-cell-num">
                      <Amount value={totalOwed} size="sm" currency={null} locale={locale} />
                    </td>
                    <td className="gts-cell-num">
                      {totalOverdue > 0 ? (
                        <Amount value={totalOverdue} size="sm" currency={null} locale={locale} />
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
