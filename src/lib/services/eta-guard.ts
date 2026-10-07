import 'server-only';

import { db } from '../db';
import { checkEtaDocument, type EtaLineFacts } from '../eta-rules';
import { BillingError } from './billing';
import { approvedEtaCodes } from './eta-codes';
import { receiverFacts } from './eta-facts';
import { organisation } from './settings';

/**
 * The server's copy of the bill form's ETA check.
 *
 * The form already refuses an invalid sales bill, but a browser can post
 * anything, so a receivable is checked again here — against the ETA's own
 * list of this taxpayer's approved codes — before it is written.
 */
export async function assertEtaReady(params: {
  clientId: string;
  issuedOn: Date | null;
  activityCode: string | null;
  currency: string;
  exchangeRate: number | string | null;
  lines: EtaLineFacts[];
}) {
  const [client, org, codes] = await Promise.all([
    db.client.findFirst({ where: { id: params.clientId, deletedAt: null } }),
    organisation(),
    approvedEtaCodes(),
  ]);

  const problems = checkEtaDocument(
    {
      issuedOn: params.issuedOn ?? new Date(),
      activityCode: params.activityCode?.trim() || org.activityCode,
      currency: params.currency,
      exchangeRate: params.exchangeRate,
      issuer: { nameEn: org.nameEn, trn: org.trn, governorateCode: org.governorateCode },
      receiver: receiverFacts(client),
      lines: params.lines,
    },
    { approvedCodes: codes, checkIssueDate: params.issuedOn !== null },
  );

  if (problems.length) {
    throw new BillingError(
      'ETA_INVALID',
      `The ETA would refuse this invoice: ${problems.map((p) => p.message).join(' ')}`,
      { problems },
    );
  }
}
