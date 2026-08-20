import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Region, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { vendorDetail } from '@/lib/services/vendors';
import { vendorSummary, vendorActivity, daysOverdue } from '@/lib/services/accounts';
import { GOVERNORATES, TRN } from '@/lib/egypt';
import { formatDate } from '@/lib/format';

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

  const [summary, activity] = await Promise.all([vendorSummary(id), vendorActivity(id, 40)]);

  const governorate = vendor.governorateCode
    ? GOVERNORATES.find((g) => g.code === vendor.governorateCode)?.en
    : null;

  const seesMoney = can(actor, 'accounts.view');

  return (
    <Shell active="/vendors" domain="vendors">
      <main className="gts-page">
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
                <a href={`/bills/new?vendorId=${vendor.id}`} className="gts-btn gts-btn-secondary">
                  Record a bill
                </a>
              )}
              {can(actor, 'vendors.edit') && (
                <a href={`/vendors/${vendor.id}/edit`} className="gts-btn gts-btn-primary">
                  Edit
                </a>
              )}
            </>
          }
        />

        {seesMoney && (
          <Region title="Account">
            <div className="gts-stat-row">
              <Figure label="Billed by them" value={summary.billed.toNumber()} />
              <Figure label="Paid" value={summary.paid.toNumber()} />
              <Figure
                label="Payable"
                value={summary.outstanding.toNumber()}
                tone={summary.outstanding.greaterThan(0) ? 'warning' : undefined}
              />
              <Figure
                label="Overdue"
                value={summary.overdue.toNumber()}
                tone={summary.overdue.greaterThan(0) ? 'danger' : undefined}
              />
            </div>
            <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
              Payment terms {vendor.paymentTermsDays} days
            </p>
          </Region>
        )}

        {/* ---------- What they have supplied ---------- */}
        {can(actor, 'inventory.view') && vendor.supplied.length > 0 && (
          <Region title="Supplied">
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">Goods received from this vendor, and returns</caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="gts-cell-num">Received</th>
                    <th scope="col" className="gts-cell-num">Returned</th>
                    <th scope="col" className="gts-cell-num">Net</th>
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
          </Region>
        )}

        {/* ---------- Their catalogue, and what we hold ---------- */}
        {can(actor, 'products.view') && vendor.catalogue.length > 0 && (
          <Region title={`Catalogue (${vendor.catalogue.length})`}>
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="gts-cell-num">Cost</th>
                    <th scope="col" className="gts-cell-num">Sale</th>
                    <th scope="col" className="gts-cell-num">On hand</th>
                    <th scope="col" className="gts-cell-num">Reorder at</th>
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
                          <Amount value={product.costPrice.toNumber()} size="sm" currency={null} />
                        </td>
                        <td className="gts-cell-num">
                          <Amount value={product.salePrice.toNumber()} size="sm" currency={null} />
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
          </Region>
        )}

        {/* ---------- Bills ---------- */}
        {can(actor, 'bills.view') && (
          <Region title={`Bills (${vendor.bills.length})`}>
            {vendor.bills.length === 0 ? (
              <Empty title="No bills" body="Nothing has been billed by this vendor yet." />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">Number</th>
                      <th scope="col">Issued</th>
                      <th scope="col">Due</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="gts-cell-num">Total</th>
                      <th scope="col" className="gts-cell-num">Outstanding</th>
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
                          <td>{formatDate(bill.issuedOn.toISOString())}</td>
                          <td>
                            {formatDate(bill.dueOn.toISOString())}
                            {late > 0 && (
                              <span className="gts-meta gts-cell-sub">{late} days late</span>
                            )}
                          </td>
                          <td>
                            <Status tone={billTone(bill.status)}>
                              {bill.status.toLowerCase().replace('_', ' ')}
                            </Status>
                          </td>
                          <td className="gts-cell-num">
                            <Amount value={bill.total.toNumber()} size="sm" currency={null} />
                          </td>
                          <td className="gts-cell-num">
                            {outstanding.lessThanOrEqualTo(0) ? (
                              <span className="gts-meta">settled</span>
                            ) : (
                              <Amount value={outstanding.toNumber()} size="sm" currency={null} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Region>
        )}

        {/* ---------- Activity ---------- */}
        <Region title="Activity">
          {activity.length === 0 ? (
            <Empty
              title="Nothing has happened yet"
              body="Receipts, bills and payments appear here as they occur."
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
                    <span className="gts-meta">{formatDate(event.at.toISOString())}</span>
                    {event.amount && seesMoney && (
                      <Amount value={event.amount.toNumber()} size="sm" currency={null} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Region>
      </main>
    </Shell>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warning';
}) {
  return (
    <div className="gts-stat">
      <p className="gts-overline">{label}</p>
      <p className={tone ? `gts-stat-value gts-stat-${tone}` : 'gts-stat-value'}>
        <Amount value={value} size="md" />
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
