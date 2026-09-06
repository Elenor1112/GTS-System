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
 * Withholding is shown BELOW the total, because it reduces the cash
 * collected rather than the amount invoiced — printing it as a deduction
 * from the total would misstate the tax document.
 */
export default async function BillPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('bills.view');
  const { id } = await params;

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

  const issuer = receivable
    ? { name: orgName, trn: org.trn, address: org.addressLine, gov: governorate(org.governorateCode) }
    : {
        name: counterpartyName,
        trn: counterparty?.trn ?? '',
        address: counterparty?.addressLine ?? '',
        gov: governorate(counterparty?.governorateCode),
      };

  const recipient = receivable
    ? {
        name: counterpartyName,
        trn: counterparty?.trn ?? '',
        address: counterparty?.addressLine ?? '',
        gov: governorate(counterparty?.governorateCode),
      }
    : { name: orgName, trn: org.trn, address: org.addressLine, gov: governorate(org.governorateCode) };

  const outstanding = outstandingOf(bill);

  return (
    <main className="gts-page" style={{ maxInlineSize: '52rem', margin: '0 auto', padding: '2rem' }}>
      <AutoPrint />

      {/* Screen-only controls. `gts-no-print` is already stripped by the
          print stylesheet, as is every .gts-btn. */}
      <div className="gts-no-print" style={{ marginBlockEnd: '2rem', display: 'flex', gap: '0.5rem' }}>
        <a href={`/bills/${bill.id}`} className="gts-btn gts-btn-secondary">
          {p.backToBill}
        </a>
      </div>

      {locale === 'ar' ? (
        <BillPrintEta bill={bill} issuer={issuer} recipient={recipient} dict={dict} />
      ) : (
        <BillPrintClassic
          bill={bill}
          issuer={issuer}
          recipient={recipient}
          outstanding={outstanding}
          dict={dict}
          locale={locale}
        />
      )}
    </main>
  );
}
