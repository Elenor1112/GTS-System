'use client';

import { useActionState, useEffect, useState } from 'react';

import { FormError, FormActions, Submit, errorFor } from '@/components/form';
import { computeTotals, type BillLine } from '@/lib/eta';
import { CURRENCY, CURRENCY_OPTIONS, VAT_RATES, WHT_RATES } from '@/lib/egypt';
import { splitAmount } from '@/lib/format';

import { submitCreateBill, submitUpdateBillLines } from './actions';

/**
 * The bill form.
 *
 * THE TOTALS SHOWN HERE ARE A PREVIEW. They come from `computeTotals()`
 * in lib/eta.ts, the same arithmetic the server runs — which is why they
 * agree — but they are NOT submitted. The form posts only line items;
 * the server recomputes every figure in Decimal and persists its own.
 *
 * The lines post as `lines[0].quantity`, `lines[1].unitPrice` … so a
 * multi-line invoice submits without JavaScript. Adding and removing
 * rows is the only thing that needs it.
 *
 * In `edit` mode it posts to `submitUpdateBillLines`, which accepts only
 * the lines and the withholding rate. The Document fieldset is hidden
 * rather than disabled, because direction and counterparty are settled
 * when the draft is created — a bill that changed from receivable to
 * payable after the fact is a different document, not an edited one.
 */

interface Option {
  id: string;
  label: string;
}

interface ProductOption {
  id: string;
  sku: string;
  nameEn: string;
  unit: string;
  salePrice: string;
  costPrice: string;
  vatRate: string;
  gpcCode: string | null;
}

interface DraftLine {
  key: number;
  productId: string;
  descriptionEn: string;
  itemCode: string;
  gpcCode: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
  vatRate: string;
}

const emptyLine = (key: number): DraftLine => ({
  key,
  productId: '',
  descriptionEn: '',
  itemCode: '',
  gpcCode: '',
  quantity: '1',
  unit: 'EA',
  unitPrice: '0',
  discount: '0',
  vatRate: '14',
});

export function BillForm({
  clients,
  vendors,
  projects,
  products,
  defaultDirection = 'RECEIVABLE',
  defaultClientId,
  defaultVendorId,
  mode = 'create',
  billId,
  initialLines,
  initialWhtRate,
}: {
  clients: Option[];
  vendors: Option[];
  projects: { id: string; label: string; clientId: string }[];
  products: ProductOption[];
  defaultDirection?: 'RECEIVABLE' | 'PAYABLE';
  defaultClientId?: string;
  defaultVendorId?: string;
  mode?: 'create' | 'edit';
  billId?: string;
  initialLines?: Omit<DraftLine, 'key'>[];
  initialWhtRate?: string;
}) {
  const editing = mode === 'edit';
  const [state, formAction] = useActionState(
    editing ? submitUpdateBillLines : submitCreateBill,
    null,
  );
  const [direction, setDirection] = useState(defaultDirection);
  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [whtRate, setWhtRate] = useState(initialWhtRate ?? '0');
  const [lines, setLines] = useState<DraftLine[]>(
    initialLines?.length
      ? initialLines.map((l, i) => ({ ...l, key: i }))
      : [emptyLine(0)],
  );
  const [nextKey, setNextKey] = useState(initialLines?.length ? initialLines.length : 1);

  useEffect(() => {
    if (state?.ok) {
      window.location.assign(`/bills/${state.data.id}`);
    }
  }, [state]);

  const e = (field: string) => errorFor(state, field);

  /** Only this client's projects — a receivable must match its project. */
  const availableProjects =
    direction === 'RECEIVABLE' && clientId
      ? projects.filter((p) => p.clientId === clientId)
      : direction === 'PAYABLE'
        ? projects
        : [];

  const setLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** Choosing a product fills the line from the catalogue. */
  const applyProduct = (key: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setLine(key, { productId: '' });
      return;
    }
    setLine(key, {
      productId,
      descriptionEn: product.nameEn,
      itemCode: product.sku,
      gpcCode: product.gpcCode ?? '',
      unit: product.unit,
      // A purchase is priced at cost; a sale at the sale price.
      unitPrice: direction === 'PAYABLE' ? product.costPrice : product.salePrice,
      vatRate: product.vatRate,
    });
  };

  /* ---- The preview. Never submitted. ---- */
  const previewLines: BillLine[] = lines.map((l) => ({
    code: l.itemCode || '—',
    descriptionEn: l.descriptionEn || 'Line',
    quantity: Number(l.quantity) || 0,
    unit: l.unit,
    unitPrice: Number(l.unitPrice) || 0,
    discount: Number(l.discount) || 0,
    vatRate: Number(l.vatRate) || 0,
  }));
  const preview = computeTotals(previewLines, Number(whtRate) || 0);

  const money = (v: number) => {
    const { negative, integer, fraction, decimal } = splitAmount(v);
    return `${negative ? '−' : ''}${integer}${decimal}${fraction}`;
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="gts-form">
      <FormError state={state} />

      {editing && billId && <input type="hidden" name="billId" value={billId} />}

      {/* ---------- Who and when ---------- */}
      {!editing && (
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">Document</legend>

        <div className="gts-field-grid">
          <div className="gts-field">
            <label className="gts-label" htmlFor="direction">
              Direction
            </label>
            <select
              id="direction"
              name="direction"
              className="gts-input gts-select"
              value={direction}
              onChange={(event) => setDirection(event.target.value as 'RECEIVABLE' | 'PAYABLE')}
            >
              <option value="RECEIVABLE">Receivable — we issue it to a client</option>
              <option value="PAYABLE">Payable — a vendor issued it to us</option>
            </select>
          </div>

          {direction === 'RECEIVABLE' ? (
            <div className="gts-field">
              <label className="gts-label" htmlFor="clientId">
                Client <span className="gts-required">*</span>
              </label>
              <select
                id="clientId"
                name="clientId"
                required
                className="gts-input gts-select"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                aria-invalid={e('clientId') ? true : undefined}
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {e('clientId') && <p className="gts-help gts-help-error">{e('clientId')}</p>}
            </div>
          ) : (
            <div className="gts-field">
              <label className="gts-label" htmlFor="vendorId">
                Vendor <span className="gts-required">*</span>
              </label>
              <select
                id="vendorId"
                name="vendorId"
                required
                defaultValue={defaultVendorId ?? ''}
                className="gts-input gts-select"
                aria-invalid={e('vendorId') ? true : undefined}
              >
                <option value="">Select a vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              {e('vendorId') && <p className="gts-help gts-help-error">{e('vendorId')}</p>}
            </div>
          )}

          <div className="gts-field">
            <label className="gts-label" htmlFor="projectId">
              Project
            </label>
            <select id="projectId" name="projectId" className="gts-input gts-select" defaultValue="">
              <option value="">No project</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="gts-help">
              {direction === 'RECEIVABLE' && !clientId
                ? 'Choose a client first'
                : 'Only this client’s projects are offered'}
            </p>
          </div>

          <div className="gts-field">
            <label className="gts-label" htmlFor="issuedOn">
              Issue date <span className="gts-required">*</span>
            </label>
            <input
              id="issuedOn"
              name="issuedOn"
              type="date"
              required
              defaultValue={today}
              className="gts-input"
              aria-invalid={e('issuedOn') ? true : undefined}
            />
          </div>

          <div className="gts-field">
            <label className="gts-label" htmlFor="dueOn">
              Due date
            </label>
            <input id="dueOn" name="dueOn" type="date" className="gts-input" />
            <p className="gts-help">Left blank, the counterparty’s payment terms apply</p>
          </div>

          <div className="gts-field">
            <label className="gts-label" htmlFor="currency">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue={CURRENCY.code}
              className="gts-input gts-select"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="gts-field">
            <label className="gts-label" htmlFor="exchangeRate">
              Exchange rate
            </label>
            <input
              id="exchangeRate"
              name="exchangeRate"
              type="number"
              step="0.000001"
              className="gts-input gts-input-num"
              aria-invalid={e('exchangeRate') ? true : undefined}
            />
            <p className="gts-help">Required when the currency is not {CURRENCY.code}</p>
          </div>

          <div className="gts-field">
            <label className="gts-label" htmlFor="whtRate">
              Withholding tax
            </label>
            <select
              id="whtRate"
              name="whtRate"
              className="gts-input gts-select"
              value={whtRate}
              onChange={(event) => setWhtRate(event.target.value)}
            >
              <option value="0">None</option>
              {WHT_RATES.map((w) => (
                <option key={w.rate} value={w.rate}>
                  {w.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>
      )}

      {/* Editing keeps the withholding rate reachable: the update action
          recomputes the bill from the lines AND this rate, so leaving it
          out of the edit form would silently reset it to zero. */}
      {editing && (
        <fieldset className="gts-fieldset">
          <legend className="gts-overline">Withholding</legend>
          <div className="gts-field" style={{ maxWidth: '22rem' }}>
            <label className="gts-label" htmlFor="whtRate">
              Withholding tax
            </label>
            <select
              id="whtRate"
              name="whtRate"
              className="gts-input gts-select"
              value={whtRate}
              onChange={(event) => setWhtRate(event.target.value)}
            >
              <option value="0">None</option>
              {WHT_RATES.map((w) => (
                <option key={w.rate} value={w.rate}>
                  {w.labelEn}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      )}

      {/* ---------- The lines ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">Line items</legend>

        <div className="gts-line-editor">
          {lines.map((line, index) => (
            <div key={line.key} className="gts-line-row">
              <div className="gts-field" style={{ flex: '2 1 16rem' }}>
                <label className="gts-label" htmlFor={`product-${line.key}`}>
                  Product
                </label>
                <select
                  id={`product-${line.key}`}
                  name={`lines[${index}].productId`}
                  className="gts-input gts-select"
                  value={line.productId}
                  onChange={(event) => applyProduct(line.key, event.target.value)}
                >
                  <option value="">Free text line</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn} — {p.sku}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gts-field" style={{ flex: '2 1 16rem' }}>
                <label className="gts-label" htmlFor={`desc-${line.key}`}>
                  Description <span className="gts-required">*</span>
                </label>
                <input
                  id={`desc-${line.key}`}
                  name={`lines[${index}].descriptionEn`}
                  required
                  className="gts-input"
                  value={line.descriptionEn}
                  onChange={(event) => setLine(line.key, { descriptionEn: event.target.value })}
                />
              </div>

              <input type="hidden" name={`lines[${index}].itemCode`} value={line.itemCode} />
              <input type="hidden" name={`lines[${index}].gpcCode`} value={line.gpcCode} />

              <div className="gts-field" style={{ flex: '0 1 6rem' }}>
                <label className="gts-label" htmlFor={`qty-${line.key}`}>
                  Qty
                </label>
                <input
                  id={`qty-${line.key}`}
                  name={`lines[${index}].quantity`}
                  type="number"
                  step="0.001"
                  required
                  className="gts-input gts-input-num"
                  value={line.quantity}
                  onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                />
              </div>

              <div className="gts-field" style={{ flex: '0 1 5rem' }}>
                <label className="gts-label" htmlFor={`unit-${line.key}`}>
                  Unit
                </label>
                <input
                  id={`unit-${line.key}`}
                  name={`lines[${index}].unit`}
                  className="gts-input"
                  value={line.unit}
                  onChange={(event) => setLine(line.key, { unit: event.target.value })}
                />
              </div>

              <div className="gts-field" style={{ flex: '0 1 8rem' }}>
                <label className="gts-label" htmlFor={`price-${line.key}`}>
                  Unit price
                </label>
                <input
                  id={`price-${line.key}`}
                  name={`lines[${index}].unitPrice`}
                  type="number"
                  step="0.01"
                  required
                  className="gts-input gts-input-num"
                  value={line.unitPrice}
                  onChange={(event) => setLine(line.key, { unitPrice: event.target.value })}
                />
              </div>

              <div className="gts-field" style={{ flex: '0 1 7rem' }}>
                <label className="gts-label" htmlFor={`disc-${line.key}`}>
                  Discount
                </label>
                <input
                  id={`disc-${line.key}`}
                  name={`lines[${index}].discount`}
                  type="number"
                  step="0.01"
                  className="gts-input gts-input-num"
                  value={line.discount}
                  onChange={(event) => setLine(line.key, { discount: event.target.value })}
                />
              </div>

              <div className="gts-field" style={{ flex: '0 1 9rem' }}>
                <label className="gts-label" htmlFor={`vat-${line.key}`}>
                  VAT
                </label>
                <select
                  id={`vat-${line.key}`}
                  name={`lines[${index}].vatRate`}
                  className="gts-input gts-select"
                  value={line.vatRate}
                  onChange={(event) => setLine(line.key, { vatRate: event.target.value })}
                >
                  {VAT_RATES.map((v) => (
                    <option key={`${v.rate}-${v.eta}`} value={v.rate}>
                      {v.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {lines.length > 1 && (
                <button
                  type="button"
                  className="gts-btn gts-btn-ghost gts-btn-sm"
                  onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
                  aria-label={`Remove line ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="gts-btn gts-btn-secondary"
          onClick={() => {
            setLines((c) => [...c, emptyLine(nextKey)]);
            setNextKey((k) => k + 1);
          }}
        >
          Add a line
        </button>
      </fieldset>

      {/* ---------- The preview ---------- */}
      <div className="gts-totals">
        <p className="gts-totals-note" style={{ borderBlockStart: 'none', paddingBlockStart: 0 }}>
          A preview. The server recomputes every figure from the lines above and stores its own —
          nothing here is submitted.
        </p>
        <Row label="Subtotal" value={money(preview.gross)} />
        {preview.discount > 0 && <Row label="Discount" value={`−${money(preview.discount)}`} />}
        <Row label="Net" value={money(preview.net)} />
        <Row label="VAT" value={money(preview.vat)} />
        <Row label="Total" value={money(preview.total)} strong />
        {preview.withheld > 0 && (
          <>
            <Row label="Withheld" value={`−${money(preview.withheld)}`} />
            <Row label="Net payable" value={money(preview.netPayable)} strong />
          </>
        )}
      </div>

      {!editing && (
        <div className="gts-field">
          <label className="gts-label" htmlFor="notes">
            Notes
          </label>
          <textarea id="notes" name="notes" rows={2} className="gts-input gts-textarea" />
        </div>
      )}

      <FormActions>
        <Submit variant="accent" pendingLabel={editing ? 'Saving…' : 'Creating…'}>
          {editing ? 'Save lines' : 'Create draft bill'}
        </Submit>
        <a
          href={editing && billId ? `/bills/${billId}` : '/bills'}
          className="gts-btn gts-btn-secondary"
        >
          Cancel
        </a>
      </FormActions>
    </form>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'gts-totals-row gts-totals-row-strong' : 'gts-totals-row'}>
      <span className={strong ? 'gts-totals-label-strong' : 'gts-totals-label'}>{label}</span>
      <span className={`gts-num ${strong ? 'gts-num-md' : 'gts-num-sm'}`}>
        <span className="gts-num-currency">{CURRENCY.mark}</span>
        {value}
      </span>
    </div>
  );
}
