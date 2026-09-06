import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { organisation } from '@/lib/services/settings';
import { outstandingOf } from '@/lib/services/billing';
import { GOVERNORATES } from '@/lib/egypt';
import { t, pickName } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

import { AutoPrint } from '@/components/auto-print';

import { BillPrintClassic } from './bill-print-classic';
import { BillPrintEta } from './bill-print-eta';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bill = await db.electronicBill.findUnique({ where: { id }, select: { number: true } });
  return { title: bill ? `${bill.number} — GTS` : 'Bill — GTS' };
}

/**
 * THE PRINTABLE BILL.
 *
 * A document, not a screen: no rail, no navigation, nothing to click.
 * It deliberately does NOT render the app Shell, because a printed
 * invoice that carries a navigation sidebar is not an invoice.
 *
 * The ETA format is the default in BOTH languages — it is the shape the
 * tax authority specifies, and which language the user reads the app in
 * does not change what a tax document has to look like. `?layout=classic`
 * still reaches the older plain layout, which additionally shows the due
 * date, the project, notes and the payment position.
 *
 * In that classic layout, withholding is shown BELOW the total, because
 * it reduces the cash collected rather than the amount invoiced —
 * printing it as a deduction from the total would misstate the document.
 */
export default async function BillPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  await requirePermission('bills.view');
  const [{ id }, { layout }] = await Promise.all([params, searchParams]);
  const classic = layout === 'classic';

  const [bill, org, dict, locale] = await Promise.all([
    db.electronicBill.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        client: true,
        vendor: true,
        project: { select: { code: true, nameEn: true } },
      },
    }),
    organisation(),
    t(),
    getLocale(),
  ]);

  if (!bill) notFound();

  const p = dict.finance.bills.print;

  const governorate = (code: number | null | undefined) =>
    code
      ? (locale === 'ar'
          ? GOVERNORATES.find((g) => g.code === code)?.ar
          : GOVERNORATES.find((g) => g.code === code)?.en) ?? null
      : null;

  // A receivable is issued BY us TO the client; a payable is the reverse.
  // The document has to name both parties the right way round.
  const receivable = bill.direction === 'RECEIVABLE';
  const counterparty = receivable ? bill.client : bill.vendor;
  const orgName = pickName({ nameEn: org.nameEn, nameAr: org.nameAr }, locale);
  const counterpartyName = counterparty ? pickName(counterparty, locale) : '—';

  // The activity code and branch id are OUR registered identifiers, so
  // they travel with the organisation party whichever side it is on.
  const orgParty = {
    name: orgName,
    trn: org.trn,
    address: org.addressLine,
    gov: governorate(org.governorateCode),
    activityCode: org.activityCode,
    branchId: org.branchId,
  };
  const counterpartyParty = {
    name: counterpartyName,
    trn: counterparty?.trn ?? '',
    address: counterparty?.addressLine ?? '',
    gov: governorate(counterparty?.governorateCode),
  };

  const issuer = receivable ? orgParty : counterpartyParty;
  const recipient = receivable ? counterpartyParty : orgParty;

  const outstanding = outstandingOf(bill);

  return (
    /* The ETA document sets its own page box in millimetres via @page, so
       it must not sit inside the app's own page padding and max width. */
    <main
      className={classic ? 'gts-page' : undefined}
      style={classic ? { maxInlineSize: '52rem', margin: '0 auto', padding: '2rem' } : undefined}
    >
      <AutoPrint />

      {/* Screen-only controls. `gts-no-print` is already stripped by the
          print stylesheet, as is every .gts-btn. */}
      <div
        className="gts-no-print"
        style={{ marginBlockEnd: '2rem', display: 'flex', gap: '0.5rem', padding: classic ? 0 : '2rem 2rem 0' }}
      >
        <a href={`/bills/${bill.id}`} className="gts-btn gts-btn-secondary">
          {p.backToBill}
        </a>
      </div>

      {classic ? (
        <BillPrintClassic
          bill={bill}
          issuer={issuer}
          recipient={recipient}
          outstanding={outstanding}
          dict={dict}
          locale={locale}
        />
      ) : (
        <BillPrintEta
          bill={bill}
          issuer={issuer}
          recipient={recipient}
          dict={dict}
          locale={locale}
        />
      )}
    </main>
  );
}
