import { describe, it, expect } from 'vitest';
import { computeTotals, formatBillNumber, taxPeriod, validateForSubmission, type BillLine, type Bill, NOT_SUBMITTED } from '@/lib/eta';
import { validateNationalId, TRN, formatPhone, isWorkingDay, GOVERNORATES } from '@/lib/egypt';

/**
 * Egyptian tax arithmetic and statutory identifiers.
 *
 * Money is the thing a business will not forgive being wrong, so the
 * totals engine is tested against hand-computed values, including the
 * cases that catch naive implementations: mixed VAT rates, discounts,
 * and withholding below the threshold.
 */

const line = (over: Partial<BillLine> = {}): BillLine => ({
  code: 'X', descriptionEn: 'Item', quantity: 1, unit: 'EA', unitPrice: 100, vatRate: 14, ...over,
});

describe('VAT', () => {
  it('applies the standard 14% rate', () => {
    const t = computeTotals([line({ quantity: 10, unitPrice: 100 })]);
    expect(t.net).toBe(1000);
    expect(t.vat).toBe(140);
    expect(t.total).toBe(1140);
  });

  it('taxes each line at its own rate rather than the aggregate', () => {
    // A standard-rated supply beside a zero-rated export. Applying 14%
    // to the combined net would overcharge by 140 — this is the bug
    // this case exists to catch.
    const t = computeTotals([
      line({ code: 'A', quantity: 10, unitPrice: 100, vatRate: 14 }),
      line({ code: 'B', quantity: 10, unitPrice: 100, vatRate: 0 }),
    ]);
    expect(t.net).toBe(2000);
    expect(t.vat).toBe(140);
    expect(t.total).toBe(2140);
  });

  it('taxes the discounted amount, not the gross', () => {
    const t = computeTotals([line({ quantity: 10, unitPrice: 100, discount: 200 })]);
    expect(t.gross).toBe(1000);
    expect(t.discount).toBe(200);
    expect(t.net).toBe(800);
    expect(t.vat).toBe(112); // 14% of 800, not of 1000
    expect(t.total).toBe(912);
  });

  it('an exempt document carries no VAT', () => {
    const t = computeTotals([line({ vatRate: 0, quantity: 5, unitPrice: 250 })]);
    expect(t.vat).toBe(0);
    expect(t.total).toBe(1250);
  });

  it('rounds to piastres without accumulating float error', () => {
    // 0.1 + 0.2 territory: three lines a naive float sum gets wrong.
    // Net 99.99 + 0.30 + 0.60 = 100.89. VAT is rounded PER LINE —
    // 14.00 + 0.04 + 0.08 = 14.12 — giving 115.01. Rounding the
    // aggregate instead would give 115.02, and the document would
    // disagree with the tax authority's own re-derivation by a piastre.
    const t = computeTotals([
      line({ quantity: 3, unitPrice: 33.33 }),
      line({ quantity: 3, unitPrice: 0.1 }),
      line({ quantity: 3, unitPrice: 0.2 }),
    ]);
    expect(t.net).toBe(100.89);
    expect(t.vat).toBe(14.12);
    expect(t.total).toBe(115.01);
    // No float dust: the total is exact to the piastre.
    expect(t.total * 100).toBeCloseTo(Math.round(t.total * 100), 9);
  });

  it('an empty document totals zero rather than NaN', () => {
    const t = computeTotals([]);
    expect(t.total).toBe(0);
    expect(t.vat).toBe(0);
    expect(t.netPayable).toBe(0);
  });
});

describe('withholding tax', () => {
  it('is deducted from the receipt but not from the total', () => {
    const t = computeTotals([line({ quantity: 100, unitPrice: 100 })], 0.5);
    expect(t.net).toBe(10_000);
    expect(t.total).toBe(11_400);   // what the client owes
    expect(t.withheld).toBe(50);    // 0.5% of the pre-VAT base
    expect(t.netPayable).toBe(11_350);
  });

  it('is computed on the net, never on the VAT-inclusive total', () => {
    const t = computeTotals([line({ quantity: 100, unitPrice: 100 })], 1);
    expect(t.withheld).toBe(100);       // 1% of 10,000
    expect(t.withheld).not.toBe(114);   // not 1% of 11,400
  });

  it('does not apply below the threshold', () => {
    const t = computeTotals([line({ quantity: 1, unitPrice: 100 })], 3);
    expect(t.total).toBeLessThan(300);
    expect(t.withheld).toBe(0);
    expect(t.netPayable).toBe(t.total);
  });

  it('is absent when no rate is supplied', () => {
    const t = computeTotals([line({ quantity: 100, unitPrice: 100 })]);
    expect(t.withheld).toBe(0);
    expect(t.netPayable).toBe(t.total);
  });
});

describe('numbering', () => {
  it('is zero-padded and sorts lexically in issue order', () => {
    expect(formatBillNumber(2026, 5)).toBe('INV-2026-00005');
    const ordered = [1, 9, 10, 100].map((n) => formatBillNumber(2026, n));
    expect([...ordered].sort()).toEqual(ordered);
  });

  it('tax periods are monthly', () => {
    expect(taxPeriod(new Date('2026-08-19T12:00:00Z'))).toBe('2026-08');
    expect(taxPeriod(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01');
  });
});

describe('submission validation', () => {
  const party = {
    nameEn: 'Test Co', trn: '284917503', addressLine: 'X', governorateCode: 1, country: 'EG' as const,
  };
  const bill = (over: Partial<Bill> = {}): Bill => ({
    number: 'INV-2026-00001', documentType: 'I', documentVersion: '1.0',
    issuedAt: '2026-08-19', dueAt: '2026-09-18', currency: 'EGP',
    issuer: party, receiver: { ...party, trn: '317604882' },
    lines: [line({ gpcCode: '10003611' })], whtRate: 0,
    status: 'DRAFT', submission: NOT_SUBMITTED, ...over,
  });

  it('a complete document passes', () => {
    expect(validateForSubmission(bill())).toEqual([]);
  });

  it('rejects a malformed tax registration number', () => {
    const problems = validateForSubmission(bill({ issuer: { ...party, trn: '123' } }));
    expect(problems.join(' ')).toContain('Issuer tax registration number');
  });

  it('requires an item code on every line', () => {
    const problems = validateForSubmission(bill({ lines: [line()] }));
    expect(problems.join(' ')).toContain('GPC/EGS');
  });

  it('requires an exchange rate for foreign currency', () => {
    const problems = validateForSubmission(bill({ currency: 'USD' }));
    expect(problems.join(' ')).toContain('exchange rate');
  });

  it('rejects a due date before the issue date', () => {
    const problems = validateForSubmission(bill({ dueAt: '2026-08-01' }));
    expect(problems.join(' ')).toContain('due date');
  });

  it('rejects a document with no lines', () => {
    const problems = validateForSubmission(bill({ lines: [] }));
    expect(problems.join(' ')).toContain('at least one line');
  });
});

describe('identifiers', () => {
  it('formats a tax registration number in threes', () => {
    expect(TRN.format('284917503')).toBe('284-917-503');
    expect(TRN.format('28491750399')).toBe('284-917-503'); // truncates overflow
  });

  it('accepts a well-formed national ID', () => {
    // 2 = born 1900s, 90-03-15, governorate 01 (Cairo).
    expect(validateNationalId('29003150101234')).toBe(true);
  });

  it('rejects impossible national IDs', () => {
    expect(validateNationalId('12345')).toBe(false);              // too short
    expect(validateNationalId('19003150101234')).toBe(false);     // bad century
    expect(validateNationalId('29013450101234')).toBe(false);     // month 34
    expect(validateNationalId('29003159901234')).toBe(false);     // governorate 99
  });

  it('accepts the born-abroad governorate code', () => {
    expect(validateNationalId('29003158801234')).toBe(true);
  });

  it('formats Egyptian mobile numbers', () => {
    expect(formatPhone('01001234567')).toBe('+20 100 1234 567');
    expect(formatPhone('+201001234567')).toBe('+20 100 1234 567');
  });
});

describe('calendar', () => {
  it('Friday and Saturday are not working days', () => {
    expect(isWorkingDay(new Date('2026-08-21T09:00:00'))).toBe(false); // Friday
    expect(isWorkingDay(new Date('2026-08-22T09:00:00'))).toBe(false); // Saturday
  });

  it('Sunday through Thursday are working days', () => {
    expect(isWorkingDay(new Date('2026-08-23T09:00:00'))).toBe(true); // Sunday
    expect(isWorkingDay(new Date('2026-08-27T09:00:00'))).toBe(true); // Thursday
  });
});

describe('geography', () => {
  it('carries all 27 governorates with plausible coordinates', () => {
    expect(GOVERNORATES).toHaveLength(27);
    for (const g of GOVERNORATES) {
      expect(g.lat, `${g.en} latitude`).toBeGreaterThan(21);
      expect(g.lat, `${g.en} latitude`).toBeLessThan(32);
      expect(g.lng, `${g.en} longitude`).toBeGreaterThan(24);
      expect(g.lng, `${g.en} longitude`).toBeLessThan(37);
    }
  });

  it('governorate codes are unique', () => {
    const codes = GOVERNORATES.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
