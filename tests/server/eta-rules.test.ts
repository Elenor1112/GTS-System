import { describe, it, expect } from 'vitest';

import {
  checkEtaDocument, issueDateWindow, type EtaCode, type EtaDocumentFacts, type EtaReceiverFacts,
} from '@/lib/eta-rules';

/**
 * The ETA rule set the bill form, the save action and the submission
 * step share. Each case is a reason the ETA has refused, or would refuse,
 * a real document.
 */

const now = new Date('2026-10-04T10:00:00Z');

const codes: EtaCode[] = [
  { codeType: 'EGS', itemCode: 'EG-123456789-CAR1', nameEn: 'Car', nameAr: null, parentCode: '10000155' },
  { codeType: 'GS1', itemCode: '6221234567890', nameEn: 'Oil', nameAr: null, parentCode: null },
];

const business: EtaReceiverFacts = {
  receiverType: 'B', nameEn: 'Client Co', nameAr: null, trn: '987654321',
  nationalId: null, foreignId: null, countryCode: 'EG', governorateCode: 1,
  regionCity: 'Nasr City', addressLine: '1 Abbas St', buildingNumber: '12',
};

const doc = (over: Partial<EtaDocumentFacts> = {}): EtaDocumentFacts => ({
  issuedOn: '2026-10-04',
  activityCode: '4510',
  currency: 'EGP',
  exchangeRate: null,
  issuer: { nameEn: 'GTS', trn: '123456789', governorateCode: 1 },
  receiver: business,
  lines: [{
    descriptionEn: 'Car', gpcCode: 'EG-123456789-CAR1', itemType: 'EGS',
    unit: 'EA', quantity: 1, unitPrice: 1000, discount: 0, vatRate: 14,
  }],
  ...over,
});

const check = (d: EtaDocumentFacts) => checkEtaDocument(d, { approvedCodes: codes, now });
const fields = (d: EtaDocumentFacts) => check(d).map((p) => p.field);

describe('ETA rules', () => {
  it('accepts a complete invoice', () => {
    expect(check(doc())).toEqual([]);
  });

  it('refuses a GPC brick as an item code (CV305)', () => {
    const d = doc({ lines: [{ ...doc().lines[0]!, gpcCode: '10000155', itemType: 'GS1' }] });
    expect(fields(d)).toEqual(['lines.0.gpcCode']);
  });

  it('refuses a missing code, an unknown unit and an odd VAT rate', () => {
    const d = doc({ lines: [{ ...doc().lines[0]!, gpcCode: '', unit: 'pcs', vatRate: 12 }] });
    expect(fields(d)).toEqual(['lines.0.gpcCode', 'lines.0.unit', 'lines.0.vatRate']);
  });

  it('format-checks codes when the approved list is unavailable', () => {
    const line = { ...doc().lines[0]!, gpcCode: 'abc', itemType: null };
    expect(checkEtaDocument(doc({ lines: [line] }), { now }).map((p) => p.field)).toEqual(['lines.0.gpcCode']);
  });

  it('holds the issue date inside the ETA window, in Cairo time', () => {
    expect(issueDateWindow(now)).toEqual({ min: '2026-09-27', max: '2026-10-04' });
    expect(fields(doc({ issuedOn: '2026-09-27' }))).toEqual([]);
    expect(fields(doc({ issuedOn: '2026-09-26' }))).toEqual(['issuedOn']);
    expect(fields(doc({ issuedOn: '2026-10-05' }))).toEqual(['issuedOn']);
    // 22:30 UTC on the 4th is already the 5th in Cairo.
    expect(issueDateWindow(new Date('2026-10-04T22:30:00Z')).max).toBe('2026-10-05');
    expect(checkEtaDocument(doc({ issuedOn: '2020-01-01' }), { approvedCodes: codes, now, checkIssueDate: false })).toEqual([]);
  });

  it('needs a 4-digit activity code and an exchange rate for foreign currency', () => {
    expect(fields(doc({ activityCode: '' }))).toEqual(['activityCode']);
    expect(fields(doc({ currency: 'USD', exchangeRate: null }))).toEqual(['exchangeRate']);
    expect(fields(doc({ currency: 'USD', exchangeRate: 48.5 }))).toEqual([]);
  });

  it('needs a business receiver to carry a TRN and a full address', () => {
    expect(fields(doc({ receiver: { ...business, trn: '12345' } }))).toEqual(['receiver']);
    expect(fields(doc({ receiver: { ...business, buildingNumber: null, regionCity: '' } })))
      .toEqual(['receiver', 'receiver']);
  });

  it('needs a national ID from a person only at EGP 50,000 or more', () => {
    const person: EtaReceiverFacts = { ...business, receiverType: 'P', trn: null, nationalId: null };
    const line = (unitPrice: number) => [{ ...doc().lines[0]!, unitPrice, vatRate: 0 }];
    expect(fields(doc({ receiver: person, lines: line(49_999) }))).toEqual([]);
    expect(fields(doc({ receiver: person, lines: line(50_000) }))).toEqual(['receiver']);
    expect(fields(doc({ receiver: { ...person, nationalId: '29001011234567' }, lines: line(50_000) }))).toEqual([]);
    // Converted to EGP before the threshold applies.
    expect(fields(doc({ receiver: person, lines: line(2_000), currency: 'USD', exchangeRate: 48.5 })))
      .toEqual(['receiver']);
  });

  it('needs a foreign receiver to name a country other than Egypt', () => {
    const foreign: EtaReceiverFacts = { ...business, receiverType: 'F', trn: null, countryCode: 'EG' };
    expect(fields(doc({ receiver: foreign }))).toEqual(['receiver']);
    expect(fields(doc({ receiver: { ...foreign, countryCode: 'SA' } }))).toEqual([]);
  });

  it('flags a missing issuer TRN and a missing receiver', () => {
    expect(fields(doc({ issuer: { nameEn: 'GTS', trn: '', governorateCode: 1 } }))).toEqual(['issuer']);
    expect(fields(doc({ receiver: null }))).toEqual(['receiver']);
  });
});
