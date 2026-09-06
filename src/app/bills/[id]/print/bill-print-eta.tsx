import QRCode from 'qrcode';
import { Prisma } from '@prisma/client';

import { formatDate, formatTime, splitAmount } from '@/lib/format';
import { CURRENCY, TRN } from '@/lib/egypt';
import { SUBMISSION_LABELS, type EtaSubmissionStatus } from '@/lib/eta';
import type { Dictionary } from '@/lib/i18n';

type Bill = {
  number: string;
  direction: 'RECEIVABLE' | 'PAYABLE';
  issuedOn: Date;
  items: {
    id: string;
    descriptionEn: string;
    descriptionAr: string | null;
    itemCode: string | null;
    unit: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discount: Prisma.Decimal;
  }[];
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  whtAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  etaUuid: string | null;
  etaLongId: string | null;
  etaStatus: string;
  etaSubmittedAt: Date | null;
};

type Party = { name: string; trn: string; address: string; gov: string | null };

/**
 * THE PRINTABLE BILL — Egyptian Tax Authority (ETA) style, Arabic/RTL.
 *
 * Mirrors the visual shape of a real ETA e-invoice PDF export. It only
 * shows the electronic number and QR code when `bill.etaUuid` is a real,
 * ETA-assigned value — this system has no submission integration yet, so
 * inventing either for an unsubmitted bill would fabricate a compliance
 * record.
 */
export async function BillPrintEta({
  bill,
  issuer,
  recipient,
  dict,
}: {
  bill: Bill;
  issuer: Party;
  recipient: Party;
  dict: Dictionary;
}) {
  const p = dict.finance.bills.print;
  const e = p.eta;

  const money = (v: number | string) => {
    const { negative, integer, fraction, decimal } = splitAmount(Number(v), 'ar');
    return `${negative ? '−' : ''}${CURRENCY.mark}${integer}${decimal}${fraction}`;
  };

  const statusText =
    SUBMISSION_LABELS[bill.etaStatus as EtaSubmissionStatus]?.ar ?? SUBMISSION_LABELS.NOT_SUBMITTED.ar;

  // A placeholder-shaped QR: it encodes the ETA UUID as plain text, not the
  // real ETA QR TLV binary payload (this system has no ETA transmission
  // integration to produce that from), and only exists when the UUID is real.
  const qrDataUri = bill.etaUuid ? await QRCode.toDataURL(bill.etaUuid, { margin: 1, width: 160 }) : null;

  return (
    <div dir="rtl">
      <header
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '1.5rem',
          alignItems: 'start',
          marginBlockEnd: '1.5rem',
        }}
      >
        <div>
          <p className="gts-overline">{e.statusLabel} : {statusText}</p>
          {bill.etaSubmittedAt && (
            <p className="gts-meta">
              {e.submissionDate} : {formatDate(bill.etaSubmittedAt.toISOString(), 'ar')} {formatTime(bill.etaSubmittedAt.toISOString(), 'ar')}
            </p>
          )}
          <p className="gts-meta">
            {e.issueDate} : {formatDate(bill.issuedOn.toISOString(), 'ar')}
          </p>
        </div>

        <div style={{ textAlign: 'end' }}>
          <h1 className="gts-display">{e.title}</h1>
        </div>
      </header>

      {qrDataUri && (
        <div className="gts-eta-qr-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUri} alt="" width={96} height={96} />
          <p className="gts-meta">{e.scanNote}</p>
        </div>
      )}

      <section style={{ marginBlockEnd: '1.5rem' }}>
        <p className="gts-eta-bar">{e.seller}</p>
        <div className="gts-eta-panel">
          <p style={{ fontWeight: 600 }}>{issuer.name}</p>
          {issuer.trn && <p className="gts-meta">{e.registrationNumber} : {TRN.format(issuer.trn)}</p>}
          {issuer.address && <p className="gts-meta">{e.address} : {issuer.address}</p>}
          {issuer.gov && <p className="gts-meta">{issuer.gov}</p>}
        </div>
        {(bill.etaUuid || bill.etaLongId) && (
          <div className="gts-eta-panel" style={{ marginBlockStart: '0.5rem' }}>
            {bill.etaUuid && <p className="gts-meta">{e.electronicNumber} : {bill.etaUuid}</p>}
            {bill.etaLongId && <p className="gts-meta">{e.internalDocRef} : {bill.etaLongId}</p>}
          </div>
        )}
      </section>

      <section style={{ marginBlockEnd: '1.5rem' }}>
        <p className="gts-eta-bar">{e.buyer}</p>
        <div className="gts-eta-panel">
          <p style={{ fontWeight: 600 }}>{recipient.name}</p>
          {recipient.trn && <p className="gts-meta">{e.registrationNumber} : {TRN.format(recipient.trn)}</p>}
          {recipient.address && <p className="gts-meta">{e.address} : {recipient.address}</p>}
          {recipient.gov && <p className="gts-meta">{recipient.gov}</p>}
        </div>
      </section>

      <table className="gts-table gts-table--eta">
        <thead>
          <tr>
            <th scope="col">{e.table.itemCode}</th>
            <th scope="col">{e.table.description}</th>
            <th scope="col" className="gts-cell-num">{e.table.qtyUnit}</th>
            <th scope="col" className="gts-cell-num">{e.table.unitPrice}</th>
            <th scope="col" className="gts-cell-num">{e.table.lineValue}</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item) => {
            const lineValue = item.quantity.toNumber() * item.unitPrice.toNumber() - item.discount.toNumber();
            return (
              <tr key={item.id}>
                <td>{item.itemCode ?? '—'}</td>
                <td>{item.descriptionAr ?? item.descriptionEn}</td>
                <td className="gts-cell-num">
                  <span className="gts-num">{item.quantity.toString()} / {item.unit}</span>
                </td>
                <td className="gts-cell-num">
                  <span className="gts-num">{money(item.unitPrice.toString())}</span>
                </td>
                <td className="gts-cell-num">
                  <span className="gts-num">{money(lineValue)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="gts-totals" style={{ marginBlockStart: '1.5rem', marginInlineStart: 'auto', maxInlineSize: '22rem' }}>
        <Row label={e.totals.salesTotal} value={money(bill.subtotal.toString())} />
        {bill.discount.toNumber() > 0 && (
          <Row label={e.totals.discountTotal} value={`−${money(bill.discount.toString())}`} />
        )}
        <Row label={e.totals.vat} value={money(bill.vatAmount.toString())} />
        <Row label={e.totals.grandTotal} value={money(bill.total.toString())} strong />
        {bill.whtAmount.toNumber() > 0 && (
          <Row label={e.totals.whtDeduction} value={`−${money(bill.whtAmount.toString())}`} />
        )}
      </div>

      <footer style={{ marginBlockStart: '3rem' }}>
        <p className="gts-meta">{e.signatureLabel} : ______________________</p>
        <p className="gts-meta" style={{ marginBlockStart: '1rem' }}>{p.disclaimer}</p>
      </footer>
    </div>
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
