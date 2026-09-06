import QRCode from 'qrcode';
import { Prisma } from '@prisma/client';

import { splitAmount } from '@/lib/format';
import { COUNTRY, CURRENCY, TRN } from '@/lib/egypt';
import { SUBMISSION_LABELS, type EtaSubmissionStatus } from '@/lib/eta';
import type { Dictionary } from '@/lib/i18n';
import type { Locale } from '@/lib/preferences';

type Bill = {
  number: string;
  direction: 'RECEIVABLE' | 'PAYABLE';
  issuedOn: Date;
  createdAt: Date;
  items: {
    id: string;
    descriptionEn: string;
    descriptionAr: string | null;
    itemCode: string | null;
    gpcCode: string | null;
    unit: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discount: Prisma.Decimal;
  }[];
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  net: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  whtAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  purchaseOrderRef: string | null;
  salesOrderRef: string | null;
  etaUuid: string | null;
  etaLongId: string | null;
  etaStatus: string;
  etaSubmittedAt: Date | null;
};

type Party = {
  name: string;
  trn: string;
  address: string;
  gov: string | null;
  activityCode?: string;
  branchId?: string;
};

/**
 * THE PRINTABLE BILL — the Egyptian Tax Authority e-invoice format.
 *
 * This reproduces the ETA's own PDF export band for band: header and
 * dual-timezone dates, the seller band with its QR, the reference row,
 * the buyer band, the bordered line-item table, the totals grid that
 * shares the table's column edges, and the authority's footer.
 *
 * BILINGUAL BY DIRECTION, NOT BY TEMPLATE. One component renders both
 * languages: `locale` picks the strings, and the layout mirrors itself
 * through CSS logical properties. There is no second Arabic component to
 * drift out of sync with this one.
 *
 * It shows the electronic number and QR only when `bill.etaUuid` is a
 * real, ETA-assigned value. This system has no submission integration,
 * so inventing either would fabricate a compliance record — but the rows
 * and the QR's box are still rendered, empty, so that an unsubmitted
 * invoice keeps exactly the layout a submitted one has.
 */
export async function BillPrintEta({
  bill,
  issuer,
  recipient,
  dict,
  locale,
}: {
  bill: Bill;
  issuer: Party;
  recipient: Party;
  dict: Dictionary;
  locale: Locale;
}) {
  const e = dict.finance.bills.print.eta;
  const ar = locale === 'ar';

  /*
   * Money renders BARE here — no currency mark beside the figure.
   * The ETA puts the unit in the column header instead ("سعر الوحدة
   * (ج.م)"), so repeating it per cell would double it. `splitAmount`
   * still supplies Latin digits in both locales, which is the existing
   * deliberate choice for Egyptian commercial documents.
   */
  const money = (v: number | string) => {
    const { negative, integer, fraction, decimal } = splitAmount(Number(v), locale);
    return `${negative ? '−' : ''}${integer}${decimal}${fraction}`;
  };

  const currencyMark = ar ? 'ج.م' : CURRENCY.mark;
  const withCurrency = (label: string) => `${label} (${currencyMark})`;

  /*
   * The authority stamps every timestamp twice: once in Cairo local
   * time and once in UTC. Resolving through the IANA zone rather than a
   * fixed +02:00 matters — Egypt observes summer time again as of 2023,
   * so a fixed offset would misstate half the year's invoices.
   */
  const stamp = (date: Date, timeZone: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-EG-u-ca-gregory-nu-latn' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone,
    }).format(date);

  const bothZones = (date: Date) =>
    `${stamp(date, COUNTRY.timezone)} (${e.cairoTime}) — ${stamp(date, 'UTC')} (${e.utcTime})`;

  const statusText =
    SUBMISSION_LABELS[bill.etaStatus as EtaSubmissionStatus]?.[locale] ??
    SUBMISSION_LABELS.NOT_SUBMITTED[locale];

  // Encodes the ETA UUID as plain text, not the real ETA QR TLV binary
  // payload — this system has no ETA transmission integration to produce
  // that from. Absent entirely unless the UUID is genuinely assigned.
  const qrDataUri = bill.etaUuid
    ? await QRCode.toDataURL(bill.etaUuid, { margin: 0, width: 320 })
    : null;

  const description = (item: Bill['items'][number]) =>
    ar ? (item.descriptionAr ?? item.descriptionEn) : item.descriptionEn;

  const dash = '—';

  return (
    <article
      className="gts-eta-doc"
      dir={ar ? 'rtl' : 'ltr'}
      /* `lang` as well as `dir`: the Arabic type rules in type.css key off
         [lang='ar'], so without it an Arabic document printed while the
         app is in English loses its Arabic face and line-heights. */
      lang={ar ? 'ar' : 'en'}
    >
      {/* ---------- 1. Header ---------- */}
      <header className="gts-eta-doc-header">
        <p className="gts-eta-doc-scannote">{e.scanNote}</p>
        <h1 className="gts-eta-doc-title">{e.title}</h1>
      </header>

      <dl className="gts-eta-doc-dates">
        <div className="gts-eta-doc-daterow">
          <dt>{e.statusLabel} :</dt>
          <dd>{statusText}</dd>
        </div>
        <div className="gts-eta-doc-daterow">
          <dt>{e.submissionDate} :</dt>
          <dd>
            {bill.etaSubmittedAt ? (
              <span className="gts-eta-doc-ltr">{bothZones(bill.etaSubmittedAt)}</span>
            ) : (
              dash
            )}
          </dd>
        </div>
        <div className="gts-eta-doc-daterow">
          <dt>{e.issueDate} :</dt>
          <dd>
            <span className="gts-eta-doc-ltr">{bothZones(bill.issuedOn)}</span>
          </dd>
        </div>
      </dl>

      {/* ---------- 2-3. Seller band + QR ---------- */}
      <div className="gts-eta-doc-partyrow">
        <div className="gts-eta-doc-qr">
          {qrDataUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUri} alt="" />
          )}
        </div>

        <section className="gts-eta-doc-band">
          <p className="gts-eta-doc-band-head">{e.seller}</p>
          <div className="gts-eta-doc-band-grid">
            <div>
              <p>
                <span className="gts-eta-doc-label">{e.nameLabel} :</span> {issuer.name}
              </p>
              <p>
                <span className="gts-eta-doc-label">{e.registrationNumber} :</span>{' '}
                <span className="gts-eta-doc-ltr">
                  {issuer.trn ? TRN.format(issuer.trn) : dash}
                </span>
              </p>
              <p>
                <span className="gts-eta-doc-label">{e.branchId} :</span>{' '}
                <span className="gts-eta-doc-ltr">{issuer.branchId || '0'}</span>
              </p>
              {issuer.address && <p>{issuer.address}</p>}
              <p>
                {[issuer.gov, COUNTRY.iso2].filter(Boolean).join(', ')}
              </p>
            </div>
            <div className="gts-eta-doc-aside">
              <p className="gts-eta-doc-label">{e.activityCode}:</p>
              <p>
                <span className="gts-eta-doc-ltr">{issuer.activityCode || dash}</span>
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- 4. Reference row ---------- */}
      <div className="gts-eta-doc-refs">
        <div className="gts-eta-doc-refrow">
          <span>
            <span className="gts-eta-doc-label">{e.electronicNumber} :</span>{' '}
            <span className="gts-eta-doc-ltr">{bill.etaUuid ?? dash}</span>
          </span>
          <span>
            <span className="gts-eta-doc-label">{e.exportProvisionalNumber} :</span>{' '}
            <span className="gts-eta-doc-ltr">{bill.etaLongId ?? dash}</span>
          </span>
        </div>
        <div className="gts-eta-doc-refrow">
          <span>
            <span className="gts-eta-doc-label">{e.purchaseOrderRef} :</span>{' '}
            {bill.purchaseOrderRef ?? dash}
          </span>
          <span>
            <span className="gts-eta-doc-label">{e.salesOrderRef} :</span>{' '}
            {bill.salesOrderRef ?? dash}
          </span>
        </div>
      </div>

      {/* ---------- 5. Buyer band ---------- */}
      <section className="gts-eta-doc-band" style={{ marginBlockEnd: '4mm' }}>
        <p className="gts-eta-doc-band-head gts-eta-doc-band-head--buyer">{e.buyer}</p>
        <div className="gts-eta-doc-band-grid">
          <div>
            <p>
              <span className="gts-eta-doc-label">{e.nameLabel} :</span> {recipient.name}
            </p>
            <p>
              <span className="gts-eta-doc-label">{e.registrationNumber} :</span>{' '}
              <span className="gts-eta-doc-ltr">
                {recipient.trn ? TRN.format(recipient.trn) : dash}
              </span>
            </p>
            {recipient.address && <p>{recipient.address}</p>}
            <p>{[recipient.gov, COUNTRY.iso2].filter(Boolean).join(', ')}</p>
          </div>
          <div className="gts-eta-doc-aside" />
        </div>
      </section>

      {/* ---------- 6. Line items ---------- */}
      <div className="gts-eta-doc-items-wrap">
        <div className="gts-eta-doc-watermark" aria-hidden="true">
          <span>{issuer.name}</span>
        </div>

        <table className="gts-eta-doc-items">
          <thead>
            <tr>
              <th scope="col">{e.table.itemName}</th>
              <th scope="col">{e.table.itemCode}</th>
              <th scope="col">{e.table.description}</th>
              <th scope="col">{e.table.qtyUnit}</th>
              <th scope="col">{withCurrency(e.table.unitPrice)}</th>
              <th scope="col">{withCurrency(e.table.lineValue)}</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item) => {
              const lineValue =
                item.quantity.toNumber() * item.unitPrice.toNumber() - item.discount.toNumber();
              return (
                <tr key={item.id}>
                  {/* The authority separates the seller's own item name from
                      the GS1/EGS code it is registered under, then the line's
                      description. Rendering the description in both the name
                      and description columns would print it twice. */}
                  <td className="gts-eta-doc-num">{item.itemCode ?? dash}</td>
                  <td className="gts-eta-doc-num">{item.gpcCode ?? dash}</td>
                  <td>{description(item)}</td>
                  <td className="gts-eta-doc-num">
                    {item.quantity.toString()}
                    <br />
                    {item.unit}
                  </td>
                  <td className="gts-eta-doc-num">{money(item.unitPrice.toString())}</td>
                  <td className="gts-eta-doc-num">{money(lineValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------- 7. Totals ----------
          A leading spacer column, then the label/value pair sized to sit
          under the item table's "unit price" and "sales value" columns,
          so the two tables read as one continuous grid rather than a
          table plus a floating summary. */}
      <table className="gts-eta-doc-totals">
        <colgroup>
          <col className="gts-eta-doc-col-pad" />
          <col className="gts-eta-doc-col-label" />
          <col className="gts-eta-doc-col-value" />
        </colgroup>
        <tbody>
          <TotalRow label={withCurrency(e.totals.salesTotal)} value={money(bill.subtotal.toString())} />
          <TotalRow
            label={withCurrency(e.totals.discountTotal)}
            value={money(bill.discount.toString())}
          />
          <TotalRow label={withCurrency(e.totals.itemsTotal)} value={money(bill.net.toString())} />
          {/* The authority prints the tax and the deduction taken on
              account of it as one stacked pair in a single row. */}
          <tr>
            <td className="gts-eta-doc-totals-spacer" />
            <td className="gts-eta-doc-totals-label">
              <span className="gts-eta-doc-totals-stack">
                <span>{withCurrency(e.totals.vat)}</span>
                <span>{e.totals.whtDeduction}</span>
              </span>
            </td>
            <td className="gts-eta-doc-totals-value">
              <span className="gts-eta-doc-totals-stack">
                <span>{money(bill.vatAmount.toString())}</span>
                <span>{money(bill.whtAmount.toString())}</span>
              </span>
            </td>
          </tr>
          <TotalRow label={withCurrency(e.totals.extraDiscount)} value={money(0)} />
          <TotalRow label={withCurrency(e.totals.grandTotal)} value={money(bill.total.toString())} />
        </tbody>
      </table>

      {/* ---------- 8. Footer ---------- */}
      <footer className="gts-eta-doc-footer">
        <div className="gts-eta-doc-footer-row">
          <span>
            <span className="gts-eta-doc-label">{e.internalNumber}:</span>{' '}
            <span className="gts-eta-doc-ltr">{bill.number}</span>
          </span>
        </div>
        <div className="gts-eta-doc-footer-row">
          <span>
            <span className="gts-eta-doc-label">{e.issuedBy}:</span> {issuer.name}
          </span>
          <span>
            <span className="gts-eta-doc-label">{e.fileCreatedAt}</span>{' '}
            <span className="gts-eta-doc-ltr">{stamp(bill.createdAt, COUNTRY.timezone)}</span>
          </span>
        </div>
        <p className="gts-eta-doc-legal">{e.legalNote}</p>
      </footer>
    </article>
  );
}

/** One totals line, padded to the item table's six columns. */
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="gts-eta-doc-totals-spacer" />
      <td className="gts-eta-doc-totals-label">{label}</td>
      <td className="gts-eta-doc-totals-value">{value}</td>
    </tr>
  );
}
