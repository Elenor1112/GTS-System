import { Prisma } from '@prisma/client';

import { formatDate, splitAmount } from '@/lib/format';
import { CURRENCY, TRN } from '@/lib/egypt';
import type { Dictionary } from '@/lib/i18n';
import type { Locale } from '@/lib/preferences';

type Bill = {
  id: string;
  number: string;
  status: string;
  direction: 'RECEIVABLE' | 'PAYABLE';
  issuedOn: Date;
  dueOn: Date;
  project: { code: string; nameEn: string } | null;
  items: {
    id: string;
    descriptionEn: string;
    itemCode: string | null;
    unit: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discount: Prisma.Decimal;
    vatRate: Prisma.Decimal;
  }[];
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  net: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  whtRate: Prisma.Decimal;
  whtAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  notes: string | null;
};

type Party = { name: string; trn: string; address: string; gov: string | null };

/**
 * THE PRINTABLE BILL — English / LTR layout.
 *
 * A document, not a screen: no rail, no navigation, nothing to click.
 * It deliberately does NOT render the app Shell, because a printed
 * invoice that carries a navigation sidebar is not an invoice.
 *
 * Withholding is shown BELOW the total, because it reduces the cash
 * collected rather than the amount invoiced — printing it as a deduction
 * from the total would misstate the tax document.
 */
export function BillPrintClassic({
  bill,
  issuer,
  recipient,
  outstanding,
  dict,
  locale,
}: {
  bill: Bill;
  issuer: Party;
  recipient: Party;
  outstanding: Prisma.Decimal;
  dict: Dictionary;
  locale: Locale;
}) {
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

  const receivable = bill.direction === 'RECEIVABLE';

  return (
    <>
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
    </>
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
