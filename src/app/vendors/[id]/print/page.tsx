import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth';
import { organisation } from '@/lib/services/settings';
import { vendorDetail } from '@/lib/services/vendors';
import { vendorSummary, daysOverdue } from '@/lib/services/accounts';
import { outstandingOf } from '@/lib/services/billing';
import { formatDate, splitAmount } from '@/lib/format';
import { CURRENCY, GOVERNORATES, TRN } from '@/lib/egypt';
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
  const vendor = await vendorDetail(id);
  return { title: vendor ? `${vendor.nameEn} — GTS` : 'Vendor — GTS' };
}

/** THE PRINTABLE VENDOR STATEMENT — outstanding bills with ageing. */
export default async function VendorPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('accounts.view');
  const { id } = await params;

  const [vendor, summary, org, dict, locale] = await Promise.all([
    vendorDetail(id),
    vendorSummary(id),
    organisation(),
    t(),
    getLocale(),
  ]);
  if (!vendor) notFound();
  const d = dict.catalogue.vendors.print;

  const money = (v: number | string) => {
    const { negative, integer, fraction, decimal } = splitAmount(Number(v), locale);
    return `${negative ? '−' : ''}${CURRENCY.mark}${integer}${decimal}${fraction}`;
  };

  const governorate = vendor.governorateCode
    ? GOVERNORATES.find((g) => g.code === vendor.governorateCode)?.en
    : null;

  const open = vendor.bills.filter((b) => b.status !== 'CANCELLED' && outstandingOf(b).greaterThan(0));

  return (
    <main className="gts-page" style={{ maxInlineSize: '52rem', margin: '0 auto', padding: '2rem' }}>
      <AutoPrint />

      <div className="gts-no-print" style={{ marginBlockEnd: '2rem', display: 'flex', gap: '0.5rem' }}>
        <a href={`/vendors/${vendor.id}`} className="gts-btn gts-btn-secondary">
          {d.backToVendor}
        </a>
      </div>

      <header style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline">{d.statementOverline} {formatDate(new Date().toISOString(), locale)}</p>
        <h1 className="gts-display" style={{ marginBlockStart: '0.25rem' }}>{vendor.nameEn}</h1>
        <p className="gts-meta">
          {vendor.code}
          {vendor.trn && ` · TRN ${TRN.format(vendor.trn)}`}
          {governorate && ` · ${governorate}`}
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
          gap: '1.5rem',
          marginBlockEnd: '2rem',
        }}
      >
        <div>
          <p className="gts-overline">{d.billedToDate}</p>
          <p>{money(summary.billed.toString())}</p>
        </div>
        <div>
          <p className="gts-overline">{d.paid}</p>
          <p>{money(summary.paid.toString())}</p>
        </div>
        <div>
          <p className="gts-overline">{d.outstanding}</p>
          <p style={{ fontWeight: 600 }}>{money(summary.outstanding.toString())}</p>
        </div>
        <div>
          <p className="gts-overline">{d.overdue}</p>
          <p>{money(summary.overdue.toString())}</p>
        </div>
      </section>

      <section>
        <p className="gts-overline" style={{ marginBlockEnd: '0.5rem' }}>{d.openBills}</p>
        {open.length === 0 ? (
          <p className="gts-meta">{d.nothingOutstanding}</p>
        ) : (
          <table className="gts-table">
            <thead>
              <tr>
                <th scope="col">{d.colBill}</th>
                <th scope="col">{d.colIssued}</th>
                <th scope="col">{d.colDue}</th>
                <th scope="col" className="gts-cell-num">{d.colTotal}</th>
                <th scope="col" className="gts-cell-num">{d.colOutstanding}</th>
                <th scope="col" className="gts-cell-num">{d.colOverdue}</th>
              </tr>
            </thead>
            <tbody>
              {open.map((bill) => {
                const overdue = daysOverdue(bill.dueOn);
                return (
                  <tr key={bill.id}>
                    <td>{bill.number}</td>
                    <td>{formatDate(bill.issuedOn.toISOString(), locale)}</td>
                    <td>{formatDate(bill.dueOn.toISOString(), locale)}</td>
                    <td className="gts-cell-num"><span className="gts-num">{money(bill.total.toString())}</span></td>
                    <td className="gts-cell-num"><span className="gts-num">{money(outstandingOf(bill).toString())}</span></td>
                    <td className="gts-cell-num">
                      <span className="gts-num">{overdue > 0 ? `${overdue}d` : '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <footer style={{ marginBlockStart: '3rem' }}>
        <p className="gts-meta">{d.producedBy} {org.nameEn} · {formatDate(new Date().toISOString(), locale)}.</p>
      </footer>
    </main>
  );
}
