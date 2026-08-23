import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { t } from '@/lib/i18n';
import { BillForm } from '../bill-form';

export const metadata: Metadata = { title: 'New bill — GTS' };
export const dynamic = 'force-dynamic';

/**
 * A new bill.
 *
 * Everything the form needs to offer — counterparties, their projects,
 * the catalogue — is fetched here on the server. The client component
 * receives plain serialisable data: Decimals cross as strings, because a
 * Prisma.Decimal cannot cross the boundary and Number() would round a
 * price the invoice then could not reproduce.
 */
export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; vendorId?: string }>;
}) {
  await requirePermission('bills.create');
  const params = await searchParams;

  const [clients, vendors, projects, products, dict] = await Promise.all([
    db.client.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, code: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    }),
    db.vendor.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, code: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    }),
    db.project.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVE', 'PLANNING', 'ON_HOLD'] } },
      select: { id: true, code: true, nameEn: true, clientId: true },
      orderBy: { code: 'desc' },
    }),
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

  return (
    <Shell active="/bills" domain="finance">
      <main className="gts-page">
        <PageHead
          overline={dict.finance.bills.nav.overline}
          title={dict.finance.bills.form.newTitle}
          lede={dict.finance.bills.form.newLede}
        />

        <BillForm
          clients={clients.map((c) => ({ id: c.id, label: `${c.nameEn} — ${c.code}` }))}
          vendors={vendors.map((v) => ({ id: v.id, label: `${v.nameEn} — ${v.code}` }))}
          projects={projects.map((p) => ({
            id: p.id,
            label: `${p.code} — ${p.nameEn}`,
            clientId: p.clientId,
          }))}
          products={products.map((p) => ({
            id: p.id,
            sku: p.sku,
            nameEn: p.nameEn,
            unit: p.unit,
            salePrice: p.salePrice.toString(),
            costPrice: p.costPrice.toString(),
            vatRate: p.vatRate.toString(),
            gpcCode: p.gpcCode,
          }))}
          defaultDirection={params.vendorId ? 'PAYABLE' : 'RECEIVABLE'}
          defaultClientId={params.clientId}
          defaultVendorId={params.vendorId}
          dict={dict.finance.bills.form}
        />
      </main>
    </Shell>
  );
}
