'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';

import { FormError, FormActions, Submit, errorFor } from '@/components/form';
import { computeTotals, type BillLine } from '@/lib/eta';
import {
  ETA_UNIT_TYPES, checkEtaDocument, issueDateWindow,
  type EtaCode, type EtaProblem, type EtaReceiverFacts,
} from '@/lib/eta-rules';
import { CURRENCY, CURRENCY_OPTIONS, VAT_RATES, WHT_RATES, governorate } from '@/lib/egypt';
import { splitAmount } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';

import { submitCreateBill, submitUpdateBillLines } from './actions';

type BillFormDict = Dictionary['finance']['bills']['form'];

/**
 * The bill form.
 *
 * A SALES bill (receivable) is laid out as the ETA's own document:
 * Document → Issuer → Receiver → Lines → Totals. It accepts only what
 * the ETA accepts. Item codes come from the taxpayer's approved ETA code
 * list, units from the ETA unit table, and `checkEtaDocument()` (the
 * same check the server and the submission step run) has to come back
 * empty before Save is enabled.
 *
 * A PURCHASE bill (payable) is the vendor's document, so it keeps the
 * plain layout and loose rules.
 *
 * THE TOTALS SHOWN HERE ARE A PREVIEW. They come from `computeTotals()`
 * in lib/eta.ts, the same arithmetic the server runs, but they are NOT
 * submitted. The form posts only line items; the server recomputes every
 * figure in Decimal and stores its own.
 *
 * The lines post as `lines[0].quantity`, `lines[1].unitPrice` … and
 * `formToArray` reassembles them on the server.
 *
 * In `edit` mode it posts to `submitUpdateBillLines`, which accepts only
 * the lines and the withholding rate: direction, counterparty and dates
 * are settled when the draft is created.
 */

interface Option {
  id: string;
  label: string;
}

export interface ClientOption extends Option {
  receiver: EtaReceiverFacts;
}

export interface IssuerInfo {
  nameEn: string;
  nameAr: string;
  trn: string;
  governorateCode: number;
  addressLine: string;
  branchId: string;
  activityCode: string;
}

export type EtaCodesState = { ok: true; codes: EtaCode[] } | { ok: false; message: string };

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
  itemType: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
  discountMode: 'amount' | 'percent';
  vatRate: string;
}

const emptyLine = (key: number): DraftLine => ({
  key,
  productId: '',
  descriptionEn: '',
  itemCode: '',
  gpcCode: '',
  itemType: '',
  quantity: '1',
  unit: 'EA',
  unitPrice: '0',
  discount: '0',
  discountMode: 'amount',
  vatRate: '14',
});

/** A line's discount as the absolute amount the server is posted. */
const lineDiscount = (l: DraftLine) =>
  l.discountMode === 'percent'
    ? (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * ((Number(l.discount) || 0) / 100)
    : Number(l.discount) || 0;

export function BillForm({
  clients,
  vendors,
  projects,
  products,
  issuer,
  etaCodes,
  etaPortal,
  defaultDirection = 'RECEIVABLE',
  defaultClientId,
  defaultVendorId,
  mode = 'create',
  billId,
  initialLines,
  initialWhtRate,
  editContext,
  dict,
}: {
  clients: ClientOption[];
  vendors: Option[];
  projects: { id: string; label: string; clientId: string }[];
  products: ProductOption[];
  issuer: IssuerInfo;
  etaCodes: EtaCodesState;
  /** The ETA portal, where codes are registered. */
  etaPortal: string;
  defaultDirection?: 'RECEIVABLE' | 'PAYABLE';
  defaultClientId?: string;
  defaultVendorId?: string;
  mode?: 'create' | 'edit';
  billId?: string;
  initialLines?: Omit<DraftLine, 'key'>[];
  initialWhtRate?: string;
  /** What an edited draft already settled: its document header. */
  editContext?: {
    direction: 'RECEIVABLE' | 'PAYABLE';
    activityCode: string | null;
    currency: string;
    exchangeRate: string | null;
  };
  dict: BillFormDict;
}) {
  const editing = mode === 'edit';
  const [state, formAction] = useActionState(
    editing ? submitUpdateBillLines : submitCreateBill,
    null,
  );
  const [direction, setDirection] = useState(editContext?.direction ?? defaultDirection);
  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [whtRate, setWhtRate] = useState(initialWhtRate ?? '0');
  const [issuedOn, setIssuedOn] = useState(() => issueDateWindow().max);
  const [activityCode, setActivityCode] = useState(editContext?.activityCode ?? '');
  const [currency, setCurrency] = useState(editContext?.currency ?? CURRENCY.code);
  const [exchangeRate, setExchangeRate] = useState(editContext?.exchangeRate ?? '');
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
  const sales = direction === 'RECEIVABLE';
  const window_ = issueDateWindow();
  const codes = etaCodes.ok ? etaCodes.codes : [];
  const findCode = (code: string) =>
    codes.find((c) => c.itemCode.toUpperCase() === code.trim().toUpperCase());

  /** Only this client's projects — a receivable must match its project. */
  const availableProjects =
    sales && clientId
      ? projects.filter((p) => p.clientId === clientId)
      : !sales
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
    // On a sales line, a catalogue code the ETA has not approved is left
    // blank, so the line asks for one instead of carrying a code that
    // will be refused.
    const approved = product.gpcCode ? findCode(product.gpcCode) : undefined;
    setLine(key, {
      productId,
      descriptionEn: product.nameEn,
      itemCode: product.sku,
      gpcCode: sales ? (approved?.itemCode ?? '') : (product.gpcCode ?? ''),
      itemType: sales ? (approved?.codeType ?? '') : '',
      unit: product.unit,
      // A purchase is priced at cost; a sale at the sale price.
      unitPrice: sales ? product.salePrice : product.costPrice,
      vatRate: product.vatRate,
    });
  };

  /* ---- The ETA check. The same function the server runs. ---- */
  const receiver = clients.find((c) => c.id === clientId)?.receiver ?? null;
  const problems: EtaProblem[] = sales
    ? checkEtaDocument(
        {
          issuedOn,
          activityCode: activityCode.trim() || issuer.activityCode,
          currency,
          exchangeRate: exchangeRate || null,
          issuer: { nameEn: issuer.nameEn, trn: issuer.trn, governorateCode: issuer.governorateCode },
          receiver,
          lines: lines.map((l) => ({
            descriptionEn: l.descriptionEn,
            gpcCode: l.gpcCode,
            itemType: l.itemType || null,
            unit: l.unit,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: lineDiscount(l),
            vatRate: l.vatRate,
          })),
        },
        { approvedCodes: etaCodes.ok ? codes : null, checkIssueDate: !editing },
      )
    : [];
  if (sales && !etaCodes.ok) {
    problems.unshift({ field: 'lines', message: dict.codesUnavailable.replace('{message}', etaCodes.message) });
  }
  const problemsFor = (prefix: string) => problems.filter((p) => p.field === prefix || p.field.startsWith(`${prefix}.`));
  const blocked = sales && problems.length > 0;

  /* ---- The preview. Never submitted. ---- */
  const previewLines: BillLine[] = lines.map((l) => ({
    code: l.itemCode || '—',
    descriptionEn: l.descriptionEn || 'Line',
    quantity: Number(l.quantity) || 0,
    unit: l.unit,
    unitPrice: Number(l.unitPrice) || 0,
    discount: lineDiscount(l),
    vatRate: Number(l.vatRate) || 0,
  }));
  const preview = computeTotals(previewLines, Number(whtRate) || 0);

  const money = (v: number) => {
    const { negative, integer, fraction, decimal } = splitAmount(v);
    return `${negative ? '−' : ''}${integer}${decimal}${fraction}`;
  };

  const gov = (code: number | null) => (code ? governorate(code)?.en : undefined);
  const notSet = <span className="gts-help gts-help-error">{dict.notSet}</span>;
  const refreshHref = '?refreshCodes=1';

  const whtSelect = (
    <select
      id="whtRate"
      name="whtRate"
      className="gts-input gts-select"
      value={whtRate}
      onChange={(event) => setWhtRate(event.target.value)}
    >
      <option value="0">{dict.withholdingNone}</option>
      {WHT_RATES.map((w) => (
        <option key={w.rate} value={w.rate}>
          {w.labelEn}
        </option>
      ))}
    </select>
  );

  return (
    <form action={formAction} className="gts-form">
      <FormError state={state} />

      {editing && billId && <input type="hidden" name="billId" value={billId} />}

      {/* ---------- Document ---------- */}
      {!editing && (
        <fieldset className="gts-fieldset">
          <legend className="gts-overline">{dict.documentLegend}</legend>
          {sales && <p className="gts-help">{dict.etaSalesNote}</p>}

          <div className="gts-field-grid">
            <div className="gts-field">
              <label className="gts-label" htmlFor="direction">
                {dict.directionLabel}
              </label>
              <select
                id="direction"
                name="direction"
                className="gts-input gts-select"
                value={direction}
                onChange={(event) => setDirection(event.target.value as 'RECEIVABLE' | 'PAYABLE')}
              >
                <option value="RECEIVABLE">{dict.receivableOption}</option>
                <option value="PAYABLE">{dict.payableOption}</option>
              </select>
            </div>

            {sales && (
              <>
                <div className="gts-field">
                  <span className="gts-label">{dict.documentTypeLabel}</span>
                  <p className="gts-input" aria-readonly="true">{dict.documentTypeInvoice}</p>
                  <p className="gts-help">{dict.documentTypeHint}</p>
                </div>
                <div className="gts-field">
                  <span className="gts-label">{dict.internalIdLabel}</span>
                  <p className="gts-input" aria-readonly="true">{dict.internalIdValue}</p>
                </div>
              </>
            )}

            <div className="gts-field">
              <label className="gts-label" htmlFor="issuedOn">
                {dict.issueDateLabel} <span className="gts-required">*</span>
              </label>
              <input
                id="issuedOn"
                name="issuedOn"
                type="date"
                required
                value={issuedOn}
                onChange={(event) => setIssuedOn(event.target.value)}
                {...(sales ? { min: window_.min, max: window_.max } : {})}
                className="gts-input"
                aria-invalid={e('issuedOn') || problemsFor('issuedOn').length ? true : undefined}
              />
              {sales && (
                <p className="gts-help">
                  {dict.issueDateWindow.replace('{min}', window_.min).replace('{max}', window_.max)}
                </p>
              )}
              <FieldProblems problems={problemsFor('issuedOn')} />
            </div>

            {sales && (
              <div className="gts-field">
                <label className="gts-label" htmlFor="activityCode">
                  {dict.activityCodeLabel}
                </label>
                <input
                  id="activityCode"
                  name="activityCode"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={issuer.activityCode}
                  className="gts-input"
                  value={activityCode}
                  onChange={(event) => setActivityCode(event.target.value.replace(/\D/g, ''))}
                  aria-invalid={e('activityCode') || problemsFor('activityCode').length ? true : undefined}
                />
                <p className="gts-help">
                  {dict.activityCodeHint.replace('{code}', issuer.activityCode || dict.notSet)}
                </p>
                <FieldProblems problems={problemsFor('activityCode')} />
              </div>
            )}

            <div className="gts-field">
              <label className="gts-label" htmlFor="currency">
                {dict.currencyLabel}
              </label>
              <select
                id="currency"
                name="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
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
                {dict.exchangeRateLabel}
              </label>
              <input
                id="exchangeRate"
                name="exchangeRate"
                type="number"
                step="0.000001"
                className="gts-input gts-input-num"
                value={exchangeRate}
                onChange={(event) => setExchangeRate(event.target.value)}
                aria-invalid={e('exchangeRate') || problemsFor('exchangeRate').length ? true : undefined}
              />
              <p className="gts-help">{dict.exchangeRateHint.replace('{currency}', CURRENCY.code)}</p>
              <FieldProblems problems={problemsFor('exchangeRate')} />
            </div>

            {/* Order references. Free text, and optional: they are printed on
                the ETA document, not used in any calculation. */}
            <div className="gts-field">
              <label className="gts-label" htmlFor="purchaseOrderRef">
                {dict.purchaseOrderRefLabel}
              </label>
              <input id="purchaseOrderRef" name="purchaseOrderRef" className="gts-input" />
            </div>

            <div className="gts-field">
              <label className="gts-label" htmlFor="salesOrderRef">
                {dict.salesOrderRefLabel}
              </label>
              <input id="salesOrderRef" name="salesOrderRef" className="gts-input" />
            </div>
          </div>
        </fieldset>
      )}

      {/* ---------- Issuer (sales only) ---------- */}
      {sales && (
        <fieldset className="gts-fieldset">
          <legend className="gts-overline">{dict.issuerLegend}</legend>
          <dl className="gts-field-grid">
            <Fact label={dict.nameLabel} value={issuer.nameAr || issuer.nameEn} />
            <Fact label={dict.trnLabel} value={issuer.trn || notSet} />
            <Fact label={dict.branchLabel} value={issuer.branchId} />
            <Fact
              label={dict.addressLabel}
              value={[issuer.addressLine, gov(issuer.governorateCode)].filter(Boolean).join(', ') || notSet}
            />
          </dl>
          <FieldProblems problems={problemsFor('issuer')} />
          {problemsFor('issuer').length > 0 && (
            <a href="/admin" className="gts-btn gts-btn-secondary gts-btn-sm">{dict.fixInAdmin}</a>
          )}
        </fieldset>
      )}

      {/* ---------- Receiver / counterparty ---------- */}
      {!editing && (
        <fieldset className="gts-fieldset">
          <legend className="gts-overline">{sales ? dict.receiverLegend : dict.vendorLabel}</legend>
          <div className="gts-field-grid">
            {sales ? (
              <div className="gts-field">
                <label className="gts-label" htmlFor="clientId">
                  {dict.clientLabel} <span className="gts-required">*</span>
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
                  <option value="">{dict.selectClient}</option>
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
                  {dict.vendorLabel} <span className="gts-required">*</span>
                </label>
                <select
                  id="vendorId"
                  name="vendorId"
                  required
                  defaultValue={defaultVendorId ?? ''}
                  className="gts-input gts-select"
                  aria-invalid={e('vendorId') ? true : undefined}
                >
                  <option value="">{dict.selectVendor}</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {e('vendorId') && <p className="gts-help gts-help-error">{e('vendorId')}</p>}
              </div>
            )}
          </div>

          {sales && receiver && (
            <dl className="gts-field-grid">
              <Fact
                label={dict.receiverTypeLabel}
                value={{ B: dict.receiverTypeB, P: dict.receiverTypeP, F: dict.receiverTypeF }[receiver.receiverType]}
              />
              <Fact
                label={dict.receiverIdLabel}
                value={
                  (receiver.receiverType === 'B' ? receiver.trn
                    : receiver.receiverType === 'P' ? receiver.nationalId
                    : receiver.foreignId) || '—'
                }
              />
              <Fact label={dict.nameLabel} value={receiver.nameAr || receiver.nameEn} />
              <Fact
                label={dict.addressLabel}
                value={
                  [receiver.buildingNumber, receiver.addressLine, receiver.regionCity,
                    receiver.countryCode === 'EG' ? gov(receiver.governorateCode) : receiver.countryCode]
                    .filter(Boolean).join(', ') || '—'
                }
              />
            </dl>
          )}
          {sales && (
            <>
              <FieldProblems problems={problemsFor('receiver')} />
              {receiver && problemsFor('receiver').length > 0 && (
                <a href={`/clients/${clientId}/edit`} className="gts-btn gts-btn-secondary gts-btn-sm">
                  {dict.editClient}
                </a>
              )}
            </>
          )}
        </fieldset>
      )}

      {/* ---------- Payment and internal details ---------- */}
      {!editing && (
        <fieldset className="gts-fieldset">
          <legend className="gts-overline">{dict.paymentLegend}</legend>
          <div className="gts-field-grid">
            <div className="gts-field">
              <label className="gts-label" htmlFor="dueOn">
                {dict.dueDateLabel}
              </label>
              <input id="dueOn" name="dueOn" type="date" className="gts-input" />
              <p className="gts-help">{dict.dueDateHint}</p>
            </div>

            <div className="gts-field">
              <label className="gts-label" htmlFor="projectId">
                {dict.projectLabel}
              </label>
              <select id="projectId" name="projectId" className="gts-input gts-select" defaultValue="">
                <option value="">{dict.noProject}</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="gts-help">
                {sales && !clientId ? dict.chooseClientFirst : dict.onlyClientProjects}
              </p>
            </div>

            <div className="gts-field">
              <label className="gts-label" htmlFor="whtRate">
                {dict.withholdingLabel}
              </label>
              {whtSelect}
            </div>
          </div>
        </fieldset>
      )}

      {/* Editing keeps the withholding rate reachable: the update action
          recomputes the bill from the lines AND this rate, so leaving it
          out of the edit form would silently reset it to zero. */}
      {editing && (
        <fieldset className="gts-fieldset">
          <legend className="gts-overline">{dict.withholdingLegend}</legend>
          <div className="gts-field" style={{ maxWidth: '22rem' }}>
            <label className="gts-label" htmlFor="whtRate">
              {dict.withholdingLabel}
            </label>
            {whtSelect}
          </div>
        </fieldset>
      )}

      {/* ---------- The lines ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">{dict.lineItemsLegend}</legend>

        {sales && !etaCodes.ok && (
          <div className="gts-help gts-help-error">
            <p>{dict.codesUnavailable.replace('{message}', etaCodes.message)}</p>
            <a href={refreshHref} className="gts-btn gts-btn-secondary gts-btn-sm">{dict.retry}</a>
          </div>
        )}
        {sales && etaCodes.ok && codes.length === 0 && (
          <div className="gts-help gts-help-error">
            <p>{dict.noApprovedCodes}</p>
            <a href={etaPortal} target="_blank" rel="noreferrer" className="gts-btn gts-btn-secondary gts-btn-sm">
              {dict.openPortal}
            </a>{' '}
            <a href={refreshHref} className="gts-btn gts-btn-ghost gts-btn-sm">{dict.refreshCodes}</a>
          </div>
        )}

        <div className="gts-line-editor">
          {lines.map((line, index) => (
            <div key={line.key}>
              <div className="gts-line-row">
                <div className="gts-field" style={{ flex: '2 1 16rem' }}>
                  <label className="gts-label" htmlFor={`product-${line.key}`}>
                    {dict.productLabel}
                  </label>
                  <select
                    id={`product-${line.key}`}
                    name={`lines[${index}].productId`}
                    className="gts-input gts-select"
                    value={line.productId}
                    onChange={(event) => applyProduct(line.key, event.target.value)}
                  >
                    <option value="">{dict.freeTextLine}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameEn} — {p.sku}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gts-field" style={{ flex: '2 1 16rem' }}>
                  <label className="gts-label" htmlFor={`desc-${line.key}`}>
                    {dict.descriptionLabel} <span className="gts-required">*</span>
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

                {sales ? (
                  <>
                    <div className="gts-field" style={{ flex: '2 1 16rem' }}>
                      <label className="gts-label" htmlFor={`code-${line.key}`}>
                        {dict.itemCodeLabel} <span className="gts-required">*</span>
                      </label>
                      <select
                        id={`code-${line.key}`}
                        className="gts-input gts-select"
                        value={findCode(line.gpcCode)?.itemCode ?? ''}
                        disabled={codes.length === 0}
                        onChange={(event) => {
                          const code = findCode(event.target.value);
                          setLine(line.key, { gpcCode: code?.itemCode ?? '', itemType: code?.codeType ?? '' });
                        }}
                        aria-invalid={problemsFor(`lines.${index}.gpcCode`).length ? true : undefined}
                      >
                        <option value="">{dict.selectItemCode}</option>
                        {(['EGS', 'GS1'] as const).map((type) => {
                          const group = codes.filter((c) => c.codeType === type);
                          return group.length ? (
                            <optgroup key={type} label={type}>
                              {group.map((c) => (
                                <option key={c.itemCode} value={c.itemCode}>
                                  {c.itemCode} — {c.nameEn}
                                </option>
                              ))}
                            </optgroup>
                          ) : null;
                        })}
                      </select>
                    </div>
                    <div className="gts-field" style={{ flex: '1 1 8rem' }}>
                      <label className="gts-label" htmlFor={`internal-${line.key}`}>
                        {dict.internalCodeLabel}
                      </label>
                      <input
                        id={`internal-${line.key}`}
                        name={`lines[${index}].itemCode`}
                        className="gts-input"
                        value={line.itemCode}
                        onChange={(event) => setLine(line.key, { itemCode: event.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <input type="hidden" name={`lines[${index}].itemCode`} value={line.itemCode} />
                )}
                <input type="hidden" name={`lines[${index}].gpcCode`} value={line.gpcCode} />
                <input type="hidden" name={`lines[${index}].itemType`} value={sales ? line.itemType : ''} />

                <div className="gts-field" style={{ flex: '0 1 6rem' }}>
                  <label className="gts-label" htmlFor={`qty-${line.key}`}>
                    {dict.quantityLabel}
                  </label>
                  <input
                    id={`qty-${line.key}`}
                    name={`lines[${index}].quantity`}
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    className="gts-input gts-input-num"
                    value={line.quantity}
                    onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                  />
                </div>

                <div className="gts-field" style={{ flex: sales ? '0 1 10rem' : '0 1 5rem' }}>
                  <label className="gts-label" htmlFor={`unit-${line.key}`}>
                    {sales ? dict.unitTypeLabel : dict.unitLabel}
                  </label>
                  {sales ? (
                    <select
                      id={`unit-${line.key}`}
                      name={`lines[${index}].unit`}
                      className="gts-input gts-select"
                      value={line.unit}
                      onChange={(event) => setLine(line.key, { unit: event.target.value })}
                      aria-invalid={problemsFor(`lines.${index}.unit`).length ? true : undefined}
                    >
                      {!ETA_UNIT_TYPES.some((u) => u.code === line.unit) && (
                        <option value={line.unit}>{line.unit || '—'}</option>
                      )}
                      {ETA_UNIT_TYPES.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.code} — {u.en}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`unit-${line.key}`}
                      name={`lines[${index}].unit`}
                      className="gts-input"
                      value={line.unit}
                      onChange={(event) => setLine(line.key, { unit: event.target.value })}
                    />
                  )}
                </div>

                <div className="gts-field" style={{ flex: '0 1 8rem' }}>
                  <label className="gts-label" htmlFor={`price-${line.key}`}>
                    {dict.unitPriceLabel}
                  </label>
                  <input
                    id={`price-${line.key}`}
                    name={`lines[${index}].unitPrice`}
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="gts-input gts-input-num"
                    value={line.unitPrice}
                    onChange={(event) => setLine(line.key, { unitPrice: event.target.value })}
                  />
                </div>

                <div className="gts-field" style={{ flex: '0 1 10rem' }}>
                  <label className="gts-label" htmlFor={`disc-${line.key}`}>
                    {dict.discountLabel}
                  </label>
                  <div className="gts-input-group">
                    <input
                      id={`disc-${line.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      className="gts-input gts-input-num"
                      value={line.discount}
                      onChange={(event) => setLine(line.key, { discount: event.target.value })}
                    />
                    <select
                      aria-label={dict.discountModeLabel}
                      className="gts-input gts-select"
                      style={{ flex: '0 0 auto' }}
                      value={line.discountMode}
                      onChange={(event) =>
                        setLine(line.key, { discountMode: event.target.value as 'amount' | 'percent' })
                      }
                    >
                      <option value="amount">{dict.discountModeAmount}</option>
                      <option value="percent">{dict.discountModePercent}</option>
                    </select>
                  </div>
                  <input
                    type="hidden"
                    name={`lines[${index}].discount`}
                    value={line.discountMode === 'percent' ? lineDiscount(line).toFixed(2) : line.discount}
                  />
                </div>

                <div className="gts-field" style={{ flex: '0 1 9rem' }}>
                  <label className="gts-label" htmlFor={`vat-${line.key}`}>
                    {dict.vatLabel}
                  </label>
                  <select
                    id={`vat-${line.key}`}
                    name={`lines[${index}].vatRate`}
                    className="gts-input gts-select"
                    value={line.vatRate}
                    onChange={(event) => setLine(line.key, { vatRate: event.target.value })}
                  >
                    {VAT_RATES.map((v) => (
                      <option key={`${v.rate}-${v.subType}`} value={v.rate}>
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
                    aria-label={dict.removeLine.replace('{n}', String(index + 1))}
                  >
                    {dict.removeLabel}
                  </button>
                )}
              </div>
              <FieldProblems problems={problemsFor(`lines.${index}`)} />
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
          {dict.addLine}
        </button>
      </fieldset>

      {/* ---------- The preview ---------- */}
      <div className="gts-totals">
        <p className="gts-totals-note" style={{ borderBlockStart: 'none', paddingBlockStart: 0 }}>
          {dict.previewNote}
        </p>
        <Row label={dict.subtotal} value={money(preview.gross)} />
        {preview.discount > 0 && <Row label={dict.discount} value={`−${money(preview.discount)}`} />}
        <Row label={dict.net} value={money(preview.net)} />
        <Row label={dict.vat} value={money(preview.vat)} />
        <Row label={dict.total} value={money(preview.total)} strong />
        {preview.withheld > 0 && (
          <>
            <Row label={dict.withheld} value={`−${money(preview.withheld)}`} />
            <Row label={dict.netPayable} value={money(preview.netPayable)} strong />
          </>
        )}
      </div>

      {!editing && (
        <div className="gts-field">
          <label className="gts-label" htmlFor="notes">
            {dict.notesLabel}
          </label>
          <textarea id="notes" name="notes" rows={2} className="gts-input gts-textarea" />
        </div>
      )}

      {blocked && (
        <div className="gts-help gts-help-error" role="status">
          <p>{dict.problemsTitle}</p>
          <ul>
            {problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}

      <FormActions>
        {/* Disabled while the ETA would refuse the document. The server
            runs the same check, so this is convenience, not the guard. */}
        <fieldset disabled={blocked} style={{ display: 'contents' }}>
          <Submit variant="accent" pendingLabel={editing ? dict.savingLabel : dict.creatingLabel}>
            {editing ? dict.saveLines : dict.createDraft}
          </Submit>
        </fieldset>
        <a
          href={editing && billId ? `/bills/${billId}` : '/bills'}
          className="gts-btn gts-btn-secondary"
        >
          {dict.cancel}
        </a>
      </FormActions>
    </form>
  );
}

function FieldProblems({ problems }: { problems: EtaProblem[] }) {
  if (problems.length === 0) return null;
  return (
    <>
      {problems.map((p, i) => (
        <p key={i} className="gts-help gts-help-error">
          {p.message}
        </p>
      ))}
    </>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="gts-field">
      <dt className="gts-label">{label}</dt>
      <dd className="gts-input" style={{ margin: 0 }}>{value}</dd>
    </div>
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
