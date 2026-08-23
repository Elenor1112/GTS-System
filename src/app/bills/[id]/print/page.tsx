import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { organisation } from '@/lib/services/settings';
import { outstandingOf } from '@/lib/services/billing';
import { formatDate, splitAmount } from '@/lib/format';
import { CURRENCY, TRN, GOVERNORATES } from '@/lib/egypt';
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
  const bill = await db.electronicBill.findUnique({ where: { id }, select: { number: true } });
  return { title: bill ? `${bill.number} — GTS` : 'Bill — GTS' };
}

/**
 * THE PRINTABLE BILL.
 *
 * A document, not a screen: no rail, no navigation, nothing to click.
 * It deliberately does NOT render the app Shell, because a printed
 * invoice that carries a navigation sidebar is not an invoice.
 *
 * Withholding is shown BELOW the total, because it reduces the cash
 * collected rather than the amount invoiced — printing it as a deduction
 * from the total would misstate the tax document.
 */
export default async function BillPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('bills.view');
  const { id } = await params;

  const [bill, org, dict, locale] = await Promise.all([
    db.electronicBill.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        client: true,
        vendor: true,
        project: { select: { code: true, nameEn: true } },
      },
    }),
    organisation(),
    t(),
    getLocale(),
  ]);

  if (!bill) notFound();

  const p = dict.finance.bills.print;
  const statusLabel = (status: string) =>
    dict.finance.bills.status[
      status
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof typeof dict.finance.bills.status
    ] ?? status.toLowerCase().replace('_', ' ');

  const money = (v: number | string) => {
    const { negative, integer, fraction, decimal } = splitAmount(Number(v), locale);
    return `${negative ? '−' : ''}${CURRENCY.mark}${integer}${decimal}${fraction}`;
  };

  const governorate = (code: number | null | undefined) =>
    code
      ? (locale === 'ar'
          ? GOVERNORATES.find((g) => g.code === code)?.ar
          : GOVERNORATES.find((g) => g.code === code)?.en) ?? null
      : null;

  // A receivable is issued BY us TO the client; a payable is the reverse.
  // The document has to name both parties the right way round.
  const receivable = bill.direction === 'RECEIVABLE';
  const counterparty = receivable ? bill.client : bill.vendor;

  const issuer = receivable
    ? { name: org.nameEn, trn: org.trn, address: org.addressLine, gov: governorate(org.governorateCode) }
    : {
        name: counterparty?.nameEn ?? '—',
        trn: counterparty?.trn ?? '',
        address: counterparty?.addressLine ?? '',
        gov: governorate(counterparty?.governorateCode),
      };

  const recipient = receivable
    ? {
        name: counterparty?.nameEn ?? '—',
        trn: counterparty?.trn ?? '',
        address: counterparty?.addressLine ?? '',
        gov: governorate(counterparty?.governorateCode),
      }
    : { name: org.nameEn, trn: org.trn, address: org.addressLine, gov: governorate(org.governorateCode) };

  const outstanding = outstandingOf(bill);

  return (
    <main className="gts-page" style={{ maxInlineSize: '52rem', margin: '0 auto', padding: '2rem' }}>
      <AutoPrint />

      {/* Screen-only controls. `gts-no-print` is already stripped by the
          print stylesheet, as is every .gts-btn. */}
      <div className="gts-no-print" style={{ marginBlockEnd: '2rem', display: 'flex', gap: '0.5rem' }}>
        <a href={`/bills/${bill.id}`} className="gts-btn gts-btn-secondary">
          {p.backToBill}
        </a>
      </div>

      <header style={{ marginBlockEnd: '2rem' }}>
        <p className="gts-overline">
          {receivable ? p.taxInvoice : p.purchaseInvoice} · {statusLabel(bill.status)}
        </p>
        <h1 className="gts-display" style={{ marginBlockStart: '0.25rem' }}>
          {bill.number}
        </h1>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
          gap: '1.5rem',
          marginBlockEnd: '2rem',
        }}
      >
        <div>
          <p className="gts-overline">{p.from}</p>
          <p style={{ fontWeight: 600 }}>{issuer.name}</p>
          {issuer.trn && <p className="gts-meta">{p.trn} {TRN.format(issuer.trn)}</p>}
          {issuer.address && <p className="gts-meta">{issuer.address}</p>}
          {issuer.gov && <p className="gts-meta">{issuer.gov}</p>}
        </div>

        <div>
          <p className="gts-overline">{p.to}</p>
          <p style={{ fontWeight: 600 }}>{recipient.name}</p>
          {recipient.trn && <p className="gts-meta">{p.trn} {TRN.format(recipient.trn)}</p>}
          {recipient.address && <p className="gts-meta">{recipient.address}</p>}
          {recipient.gov && <p className="gts-meta">{recipient.gov}</p>}
        </div>

        <div>
          <p className="gts-overline">{p.issued}</p>
          <p>{formatDate(bill.issuedOn.toISOString(), locale)}</p>
          <p className="gts-overline" style={{ marginBlockStart: '0.75rem' }}>{p.due}</p>
          <p>{formatDate(bill.dueOn.toISOString(), locale)}</p>
          {bill.project && (
            <>
              <p className="gts-overline" style={{ marginBlockStart: '0.75rem' }}>{p.project}</p>
              <p>{bill.project.code}</p>
            </>
          )}
        </div>
      </section>

      <table className="gts-table">
        <thead>
          <tr>
            <th scope="col">{p.table.index}</th>
            <th scope="col">{p.table.description}</th>
            <th scope="col" className="gts-cell-num">{p.table.qty}</th>
            <th scope="col">{p.table.unit}</th>
            <th scope="col" className="gts-cell-num">{p.table.unitPrice}</th>
            <th scope="col" className="gts-cell-num">{p.table.discount}</th>
            <th scope="col" className="gts-cell-num">{p.table.vat}</th>
            <th scope="col" className="gts-cell-num">{p.table.net}</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, index) => {
            const net =
              item.quantity.toNumber() * item.unitPrice.toNumber() - item.discount.toNumber();
            return (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>
                  {item.descriptionEn}
                  {item.itemCode && <div className="gts-meta">{item.itemCode}</div>}
                </td>
                <td className="gts-cell-num">
                  <span className="gts-num">{item.quantity.toString()}</span>
                </td>
                <td>{item.unit}</td>
                <td className="gts-cell-num">
                  <span className="gts-num">{money(item.unitPrice.toString())}</span>
                </td>
                <td className="gts-cell-num">
                  <span className="gts-num">
                    {item.discount.toNumber() > 0 ? money(item.discount.toString()) : '—'}
                  </span>
                </td>
                <td className="gts-cell-num">
                  <span className="gts-num">{item.vatRate.toString()}%</span>
                </td>
                <td className="gts-cell-num">
                  <span className="gts-num">{money(net)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="gts-totals" style={{ marginBlockStart: '1.5rem', marginInlineStart: 'auto', maxInlineSize: '22rem' }}>
        <Row label={p.totals.subtotal} value={money(bill.subtotal.toString())} />
        {bill.discount.toNumber() > 0 && (
          <Row label={p.totals.discount} value={`−${money(bill.discount.toString())}`} />
        )}
        <Row label={p.totals.net} value={money(bill.net.toString())} />
        <Row label={p.totals.vat} value={money(bill.vatAmount.toString())} />
        <Row label={p.totals.total} value={money(bill.total.toString())} strong />
        {bill.whtAmount.toNumber() > 0 && (
          <>
            {/* Below the total, deliberately: withholding reduces the
                cash collected, not the amount invoiced. */}
            <Row label={p.totals.withheld(bill.whtRate.toString())} value={`−${money(bill.whtAmount.toString())}`} />
            <Row
              label={p.totals.netPayable}
              value={money(bill.total.toNumber() - bill.whtAmount.toNumber())}
              strong
            />
          </>
        )}
        {bill.paidAmount.toNumber() > 0 && (
          <>
            <Row label={p.totals.paid} value={money(bill.paidAmount.toString())} />
            <Row label={p.totals.outstanding} value={money(outstanding.toString())} strong />
          </>
        )}
      </div>

      {bill.notes && (
        <section style={{ marginBlockStart: '2rem' }}>
          <p className="gts-overline">{p.notes}</p>
          <p>{bill.notes}</p>
        </section>
      )}

      <footer style={{ marginBlockStart: '3rem' }}>
        <p className="gts-meta">
          {/* Honest about what this is. There is no ETA transmission
              integration, so the document does not imply one. */}
          {p.disclaimer}
        </p>
      </footer>
    </main>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'gts-totals-row gts-totals-row-strong' : 'gts-totals-row'}>
      <span className={strong ? 'gts-totals-label-strong' : 'gts-totals-label'}>{label}</span>
      <span className={`gts-num ${strong ? 'gts-num-md' : 'gts-num-sm'}`}>{value}</span>
    </div>
  );
}
