import 'server-only';

import type { EtaCode } from '../eta-rules';
import { EtaError, listMyApprovedCodes } from './eta-client';

/**
 * GTS — the taxpayer's approved ETA item codes.
 *
 * A sales line may only carry a code the ETA has approved for this
 * taxpayer; anything else fails the document's code step (CV305). The
 * list changes only when someone registers a code on the portal, so it is
 * cached for a few minutes rather than fetched on every page load.
 */

const TTL_MS = 15 * 60 * 1000;

let cached: { codes: EtaCode[]; at: number } | null = null;

export async function approvedEtaCodes(options: { refresh?: boolean } = {}): Promise<EtaCode[]> {
  if (!options.refresh && cached && Date.now() - cached.at < TTL_MS) return cached.codes;

  const rows = await listMyApprovedCodes();
  const codes: EtaCode[] = rows.map((r) => ({
    codeType: (r.codeTypeName ?? '').toUpperCase() === 'GS1' ? 'GS1' : 'EGS',
    itemCode: r.itemCode!,
    nameEn: r.codeNamePrimaryLang ?? r.itemCode!,
    nameAr: r.codeNameSecondaryLang ?? null,
    parentCode: r.parentItemCode ?? null,
  }));
  cached = { codes, at: Date.now() };
  return codes;
}

/** For tests: forget the cached list. */
export function resetEtaCodes(): void {
  cached = null;
}

/** The list, or why it could not be had — for a page that must still render. */
export async function loadEtaCodes(
  options: { refresh?: boolean } = {},
): Promise<{ ok: true; codes: EtaCode[] } | { ok: false; message: string }> {
  try {
    return { ok: true, codes: await approvedEtaCodes(options) };
  } catch (error) {
    const message = error instanceof EtaError
      ? error.message
      : 'The ETA could not be reached.';
    if (!(error instanceof EtaError)) console.error('[eta-codes] loading codes failed:', error);
    return { ok: false, message };
  }
}
