import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { isEditable } from '@/lib/services/billing';
import { t } from '@/lib/i18n';
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
export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('bills.edit');
  const { id } = await params;

  const bill = await db.electronicBill.findFirst({
    where: { id, deletedAt: null },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!bill) notFound();

  if (!isEditable(bill.status)) redirect(`/bills/${bill.id}`);

  const [products, dict] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true, sku: true, nameEn: true, unit: true,
        salePrice: true, costPrice: true, vatRate: true, gpcCode: true,
      },
      orderBy: { nameEn: 'asc' },
    }),
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
          // The counterparty lists are not offered in edit mode, but the
          // component still types them as required.
          clients={[]}
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
            quantity: item.quantity.toString(),
            unit: item.unit,
            unitPrice: item.unitPrice.toString(),
            discount: item.discount.toString(),
            vatRate: item.vatRate.toString(),
          }))}
          dict={f}
        />
      </main>
    </Shell>
  );
}
