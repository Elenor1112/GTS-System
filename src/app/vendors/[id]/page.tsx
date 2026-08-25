import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { vendorDetail } from '@/lib/services/vendors';
import { vendorSummary, vendorActivity, daysOverdue } from '@/lib/services/accounts';
import { GOVERNORATES, TRN } from '@/lib/egypt';
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
  const vendor = await vendorDetail(id);
  return { title: vendor ? `${vendor.nameEn} — GTS` : 'Vendor — GTS' };
}

/**
 * VENDOR — the supply relationship.
 *
 * Goods in, goods back, bills, payments, balance. The same spine as the
 * client page read from the other direction, and assembled from the same
 * kind of real rows — a `VendorProductTransaction` per receipt, a bill
 * per invoice, a payment per settlement.
 */
export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('vendors.view');
  const { id } = await params;

  const vendor = await vendorDetail(id);
  if (!vendor) notFound();

  const [summary, activity, dict, locale] = await Promise.all([
    vendorSummary(id),
    vendorActivity(id, 40),
    t(),
    getLocale(),
  ]);
  const d = dict.catalogue.vendors.detail;

  const governorate = vendor.governorateCode
    ? GOVERNORATES.find((g) => g.code === vendor.governorateCode)?.en
    : null;

  const seesMoney = can(actor, 'accounts.view');

  return (
    <Shell active="/vendors" domain="vendors">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={`Vendor · ${vendor.code}`}
          title={vendor.nameEn}
          lede={
            [
              vendor.contactName,
              governorate,
              vendor.trn ? `TRN ${TRN.format(vendor.trn)}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined
          }
          actions={
            <>
              {can(actor, 'bills.create') && (
                <a
                  href={`/bills/new?vendorId=${vendor.id}`}
                  className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center gap-2"
                >
                  <Icon name="receipt_long" />
                  {d.recordBill}
                </a>
              )}
              {can(actor, 'vendors.edit') && (
                <a
                  href={`/vendors/${vendor.id}/edit`}
                  className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  <Icon name="edit" />
                  {d.edit}
                </a>
              )}
              {seesMoney && (
                <a
                  href={`/vendors/${vendor.id}/print`}
                  className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center gap-2"
                >
                  <Icon name="print" />
                  {d.printStatement}
                </a>
              )}
            </>
          }
        />

        {seesMoney && (
          <section>
            <h2 className="text-lg font-semibold text-fg mb-4">{d.account}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Figure label={d.billedByThem} value={summary.billed.toNumber()} locale={locale} />
              <Figure label={d.paid} value={summary.paid.toNumber()} locale={locale} />
              <Figure
                label={d.payable}
                value={summary.outstanding.toNumber()}
                tone={summary.outstanding.greaterThan(0) ? 'warning' : undefined}
                locale={locale}
              />
              <Figure
                label={d.overdue}
                value={summary.overdue.toNumber()}
                tone={summary.overdue.greaterThan(0) ? 'danger' : undefined}
                locale={locale}
              />
            </div>
            <p className="gts-meta mt-4">
              {d.paymentTerms} {vendor.paymentTermsDays} {d.daysSuffix}
            </p>
          </section>
        )}

        {/* ---------- What they have supplied ---------- */}
        {can(actor, 'inventory.view') && vendor.supplied.length > 0 && (
          <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <h2 className="text-lg font-semibold text-fg px-6 pt-6 pb-4">{d.supplied}</h2>
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">Goods received from this vendor, and returns</caption>
                <thead>
                  <tr>
                    <th scope="col">{d.colProduct}</th>
                    <th scope="col" className="gts-cell-num">{d.colReceived}</th>
                    <th scope="col" className="gts-cell-num">{d.colReturned}</th>
                    <th scope="col" className="gts-cell-num">{d.colNet}</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.supplied.map((row) => (
                    <tr key={row.productId}>
                      <th scope="row">
                        <a href={`/products/${row.productId}`} className="gts-cell-link">
                          {row.nameEn}
                        </a>
                        <span className="gts-meta gts-cell-sub">
                          <bdi>{row.sku}</bdi> · {row.unit}
                        </span>
                      </th>
                      <td className="gts-cell-num">{row.received.toString()}</td>
                      <td className="gts-cell-num">
                        {row.returned.isZero() ? (
                          <span className="gts-meta">—</span>
                        ) : (
                          <Status tone="warning">{row.returned.toString()}</Status>
                        )}
                      </td>
                      <td className="gts-cell-num">
                        <strong>{row.net.toString()}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ---------- Their catalogue, and what we hold ---------- */}
        {can(actor, 'products.view') && vendor.catalogue.length > 0 && (
          <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <h2 className="text-lg font-semibold text-fg px-6 pt-6 pb-4">{`${d.catalogue} (${vendor.catalogue.length})`}</h2>
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <thead>
                  <tr>
                    <th scope="col">{d.colProduct}</th>
                    <th scope="col" className="gts-cell-num">{d.colCost}</th>
                    <th scope="col" className="gts-cell-num">{d.colSale}</th>
                    <th scope="col" className="gts-cell-num">{d.colOnHand}</th>
                    <th scope="col" className="gts-cell-num">{d.colReorderAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.catalogue.map((product) => {
                    const low =
                      product.reorderLevel.greaterThan(0) &&
                      product.onHand.lessThanOrEqualTo(product.reorderLevel);
                    return (
                      <tr key={product.id}>
                        <th scope="row">
                          <a href={`/products/${product.id}`} className="gts-cell-link">
                            {product.nameEn}
                          </a>
                          <span className="gts-meta gts-cell-sub">
                            <bdi>{product.sku}</bdi> · {product.unit}
                          </span>
                        </th>
                        <td className="gts-cell-num">
                          <Amount value={product.costPrice.toNumber()} size="sm" currency={null} locale={locale} />
                        </td>
                        <td className="gts-cell-num">
                          <Amount value={product.salePrice.toNumber()} size="sm" currency={null} locale={locale} />
                        </td>
                        <td className="gts-cell-num">
                          {low ? (
                            <Status tone="warning">{product.onHand.toString()}</Status>
                          ) : (
                            product.onHand.toString()
                          )}
                        </td>
                        <td className="gts-cell-num">
                          {product.reorderLevel.isZero() ? (
                            <span className="gts-meta">—</span>
                          ) : (
                            product.reorderLevel.toString()
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ---------- Bills ---------- */}
        {can(actor, 'bills.view') && (
          <section className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <h2 className="text-lg font-semibold text-fg px-6 pt-6 pb-4">{`${d.bills} (${vendor.bills.length})`}</h2>
            {vendor.bills.length === 0 ? (
              <div className="px-6 pb-6">
                <Empty title={d.emptyBillsTitle} body={d.emptyBillsBody} />
              </div>
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">{d.colNumber}</th>
                      <th scope="col">{d.colIssued}</th>
                      <th scope="col">{d.colDue}</th>
                      <th scope="col">{d.colStatus}</th>
                      <th scope="col" className="gts-cell-num">{d.colTotal}</th>
                      <th scope="col" className="gts-cell-num">{d.colOutstanding}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendor.bills.map((bill) => {
                      const outstanding = bill.total.minus(bill.whtAmount).minus(bill.paidAmount);
                      const late = bill.status === 'OVERDUE' ? daysOverdue(bill.dueOn) : 0;
                      return (
                        <tr key={bill.id}>
                          <th scope="row">
                            <a href={`/bills/${bill.id}`} className="gts-cell-link">
                              <bdi>{bill.number}</bdi>
                            </a>
                          </th>
                          <td>{formatDate(bill.issuedOn.toISOString(), locale)}</td>
                          <td>
                            {formatDate(bill.dueOn.toISOString(), locale)}
                            {late > 0 && (
                              <span className="gts-meta gts-cell-sub">{late} {d.daysLateSuffix}</span>
                            )}
                          </td>
                          <td>
                            <Status tone={billTone(bill.status)}>
                              {bill.status.toLowerCase().replace('_', ' ')}
                            </Status>
                          </td>
                          <td className="gts-cell-num">
                            <Amount value={bill.total.toNumber()} size="sm" currency={null} locale={locale} />
                          </td>
                          <td className="gts-cell-num">
                            {outstanding.lessThanOrEqualTo(0) ? (
                              <span className="gts-meta">{d.settled}</span>
                            ) : (
                              <Amount value={outstanding.toNumber()} size="sm" currency={null} locale={locale} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---------- Activity ---------- */}
        <section className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">{d.activity}</h2>
          {activity.length === 0 ? (
            <Empty
              title={d.emptyActivityTitle}
              body={d.emptyActivityBody}
            />
          ) : (
            <ol className="gts-timeline">
              {activity.map((event, index) => (
                <li key={`${event.kind}-${index}`} className="gts-timeline-row" data-kind={event.kind}>
                  <span className="gts-timeline-dot" aria-hidden="true" />
                  <div className="gts-timeline-body">
                    <p className="gts-timeline-title">
                      {event.href ? (
                        <a href={event.href} className="gts-cell-link">
                          {event.title}
                        </a>
                      ) : (
                        event.title
                      )}
                    </p>
                    <p className="gts-meta">{event.detail}</p>
                  </div>
                  <div className="gts-timeline-aside">
                    <span className="gts-meta">{formatDate(event.at.toISOString(), locale)}</span>
                    {event.amount && seesMoney && (
                      <Amount value={event.amount.toNumber()} size="sm" currency={null} locale={locale} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </Shell>
  );
}

function Figure({
  label,
  value,
  tone,
  locale,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warning';
  locale?: 'en' | 'ar';
}) {
  return (
    <div className="bg-surface rounded-lg border border-line shadow-raised p-5">
      <p className="text-xs text-fg-muted uppercase tracking-wide">{label}</p>
      <p className={`mt-2 ${tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : ''}`}>
        <Amount value={value} size="md" locale={locale} />
      </p>
    </div>
  );
}

function billTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'OVERDUE') return 'danger' as const;
  if (status === 'PARTIALLY_PAID' || status === 'PENDING_APPROVAL') return 'warning' as const;
  if (status === 'CANCELLED') return 'neutral' as const;
  return 'info' as const;
}
