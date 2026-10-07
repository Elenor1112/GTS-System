import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { isEditable } from '@/lib/services/billing';
import { t } from '@/lib/i18n';
import { etaPortalUrl } from '@/lib/services/eta-client';
import { loadEtaCodes } from '@/lib/services/eta-codes';
import { receiverFacts } from '@/lib/services/eta-facts';
import { organisation } from '@/lib/services/settings';
import { BillForm } from '../../bill-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bill = await db.electronicBill.findUnique({ where: { id }, select: { number: true } });
  return { title: bill ? `Edit ${bill.number} — GTS` : 'Edit bill — GTS' };
}

/**
 * EDIT A DRAFT BILL'S LINES.
 *
 * Only the lines and the withholding rate. Direction, counterparty and
 * dates are settled when the draft is created — changing those after the
 * fact makes it a different document, not an edited one.
 *
 * Only a DRAFT is editable. `updateBillLines` enforces that in the
 * transaction; this page checks it too, so somebody following a stale
 * link to a bill that has since been approved is sent back to it rather
 * than shown a form whose submission is guaranteed to fail.
 */
export default async function EditBillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ refreshCodes?: string }>;
}) {
  await requirePermission('bills.edit');
  const { id } = await params;
  const { refreshCodes } = await searchParams;

  const bill = await db.electronicBill.findFirst({
    where: { id, deletedAt: null },
    include: { items: { orderBy: { sortOrder: 'asc' } }, client: true },
  });
  if (!bill) notFound();

  if (!isEditable(bill.status)) redirect(`/bills/${bill.id}`);

  const sales = bill.direction === 'RECEIVABLE';
  const [products, org, etaCodes, dict] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true, sku: true, nameEn: true, unit: true,
        salePrice: true, costPrice: true, vatRate: true, gpcCode: true,
      },
      orderBy: { nameEn: 'asc' },
    }),
    organisation(),
    // Only a sales bill needs the ETA's code list.
    sales
      ? loadEtaCodes({ refresh: refreshCodes === '1' })
      : Promise.resolve({ ok: true as const, codes: [] }),
    t(),
  ]);
  const f = dict.finance.bills.form;

  return (
    <Shell active="/bills" domain="finance">
      <main className="gts-page">
        <PageHead
          overline={`${f.editOverlinePrefix} · ${bill.number}`}
          title={f.editTitle}
          lede={f.editLede}
        />

        <BillForm
          mode="edit"
          billId={bill.id}
          // The counterparty is not changed in edit mode; a sales bill's
          // own client is passed so its receiver can still be checked.
          clients={
            bill.client
              ? [{ id: bill.client.id, label: bill.client.nameEn, receiver: receiverFacts(bill.client)! }]
              : []
          }
          defaultClientId={bill.clientId ?? undefined}
          issuer={org}
          etaCodes={etaCodes}
          etaPortal={etaPortalUrl()}
          editContext={{
            direction: bill.direction,
            activityCode: bill.activityCode,
            currency: bill.currency,
            exchangeRate: bill.exchangeRate?.toString() ?? null,
          }}
          vendors={[]}
          projects={[]}
          products={products.map((p) => ({
            id: p.id,
            sku: p.sku,
            nameEn: p.nameEn,
            unit: p.unit,
            // Decimals cross the server/client boundary as strings: a
            // Prisma.Decimal cannot be serialised, and Number() would
            // round a price the invoice then could not reproduce.
            salePrice: p.salePrice.toString(),
            costPrice: p.costPrice.toString(),
            vatRate: p.vatRate.toString(),
            gpcCode: p.gpcCode,
          }))}
          initialWhtRate={bill.whtRate.toString()}
          initialLines={bill.items.map((item) => ({
            productId: item.productId ?? '',
            descriptionEn: item.descriptionEn,
            itemCode: item.itemCode ?? '',
            gpcCode: item.gpcCode ?? '',
            itemType: item.itemType ?? '',
            quantity: item.quantity.toString(),
            unit: item.unit,
            unitPrice: item.unitPrice.toString(),
            discount: item.discount.toString(),
            discountMode: 'amount' as const,
            vatRate: item.vatRate.toString(),
          }))}
          dict={f}
        />
      </main>
    </Shell>
  );
}
