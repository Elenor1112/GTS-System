import { describe, it, expect } from 'vitest';

import {
  buildEtaDocument, etaIssueTimestamp, itemType, vatSubType, type EtaBillInput,
} from '@/lib/services/eta-document';

/**
 * The ETA document.
 *
 * The ETA re-derives every figure it is sent and rejects a document whose
 * lines and totals disagree, so these check the relationships it checks:
 * net = sales − discount, total = net + tax, and the header sums.
 */

const issuer = {
  nameEn: 'GTS Trading', nameAr: 'جي تي إس', trn: '123-456-789',
  addressLine: '1 Tahrir St', governorateCode: 1, activityCode: '4620', branchId: '0',
};
const receiver = { nameEn: 'Client Co', trn: '987654321', addressLine: null, governorateCode: 21 };

const bill = (over: Partial<EtaBillInput> = {}): EtaBillInput => ({
  number: 'INV-2026-00001',
  documentType: 'I',
  issuedOn: new Date('2026-09-30T00:00:00Z'),
  currency: 'EGP',
  exchangeRate: null,
  purchaseOrderRef: 'PO-77',
  salesOrderRef: null,
  items: [
    {
      descriptionEn: 'Cement', descriptionAr: null, itemCode: 'SKU-1', gpcCode: '10005844',
      quantity: 10, unit: 'BG', unitPrice: 100, discount: 50, vatRate: 14,
      lineNet: 950, lineVat: 133,
    },
    {
      descriptionEn: 'Consulting', descriptionAr: null, itemCode: null, gpcCode: 'EG-123456789-1',
      quantity: 2, unit: 'HUR', unitPrice: 500, discount: 0, vatRate: 0,
      lineNet: 1000, lineVat: 0,
    },
  ],
  ...over,
});

const now = new Date('2026-10-01T12:00:00Z');

describe('ETA document', () => {
  it('keeps every line internally consistent', () => {
    const doc = buildEtaDocument({ bill: bill(), issuer, receiver, now });
    for (const line of doc.invoiceLines) {
      expect(line.netTotal).toBeCloseTo(line.salesTotal - line.discount.amount, 5);
      expect(line.total).toBeCloseTo(line.netTotal + line.taxableItems[0]!.amount, 5);
      expect(line.salesTotal).toBeCloseTo(line.quantity * line.unitValue.amountEGP, 5);
    }
  });

  it('sums the header from the lines', () => {
    const doc = buildEtaDocument({ bill: bill(), issuer, receiver, now });
    expect(doc.totalSalesAmount).toBe(2000);
    expect(doc.totalDiscountAmount).toBe(50);
    expect(doc.netAmount).toBe(1950);
    expect(doc.taxTotals).toEqual([{ taxType: 'T1', amount: 133 }]);
    expect(doc.totalAmount).toBe(2083);
  });

  it('carries the parties and references the ETA requires', () => {
    const doc = buildEtaDocument({ bill: bill(), issuer, receiver, now });
    expect(doc.issuer.id).toBe('123456789');
    expect(doc.issuer.address.branchID).toBe('0');
    expect(doc.issuer.address.governate).toBe('Cairo');
    expect(doc.receiver.address.governate).toBe('Giza');
    expect(doc.receiver.address.street).toBe('Client Co');
    expect(doc.taxpayerActivityCode).toBe('4620');
    expect(doc.internalID).toBe('INV-2026-00001');
    expect(doc.purchaseOrderReference).toBe('PO-77');
    expect(doc).not.toHaveProperty('salesOrderReference');
    expect(doc.documentTypeVersion).toBe('0.9');
  });

  it('codes VAT as T1 with the right subtype', () => {
    const doc = buildEtaDocument({ bill: bill(), issuer, receiver, now });
    expect(doc.invoiceLines[0]!.taxableItems[0]).toMatchObject({ taxType: 'T1', subType: 'V009', rate: 14 });
    expect(doc.invoiceLines[1]!.taxableItems[0]).toMatchObject({ taxType: 'T1', subType: 'V003', rate: 0 });
    expect(doc.invoiceLines[0]!.itemType).toBe('GS1');
    expect(doc.invoiceLines[1]!.itemType).toBe('EGS');
  });

  it('converts a foreign-currency document to EGP', () => {
    const doc = buildEtaDocument({
      bill: bill({ currency: 'USD', exchangeRate: '48.5' }),
      issuer, receiver, now,
    });
    const first = doc.invoiceLines[0]!;
    expect(first.unitValue).toEqual({
      currencySold: 'USD', amountSold: 100, currencyExchangeRate: 48.5, amountEGP: 4850,
    });
    expect(first.salesTotal).toBe(48500);
    expect(first.discount.amount).toBe(2425);
    expect(first.taxableItems[0]!.amount).toBe(6450.5);
    expect(doc.invoiceLines[1]!.taxableItems[0]!.subType).toBe('V001');
    expect(doc.totalAmount).toBeCloseTo(doc.netAmount + doc.taxTotals[0]!.amount, 5);
  });
});

describe('ETA helpers', () => {
  it('never stamps a document in the future', () => {
    expect(etaIssueTimestamp(new Date('2026-09-30T00:00:00Z'), now)).toBe('2026-09-30T08:00:00Z');
    const early = new Date('2026-10-01T05:00:00Z');
    expect(etaIssueTimestamp(new Date('2026-10-01T00:00:00Z'), early)).toBe('2026-10-01T04:59:00Z');
  });

  it('picks the VAT subtype and item scheme', () => {
    expect(vatSubType(14, 'EGP')).toBe('V009');
    expect(vatSubType(0, 'EGP')).toBe('V003');
    expect(vatSubType(0, 'USD')).toBe('V001');
    expect(itemType('eg-1-2')).toBe('EGS');
    expect(itemType('10005844')).toBe('GS1');
  });
});
