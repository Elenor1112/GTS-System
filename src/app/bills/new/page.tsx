import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
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

  const [clients, vendors, projects, products] = await Promise.all([
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
  ]);

  return (
    <Shell active="/bills" domain="finance">
      <main className="gts-page">
        <PageHead
          overline="Tax documents"
          title="New bill"
          lede="Add the lines. Every total — net, VAT per line, the invoice total and any withholding — is computed on the server from what you enter here."
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
        />
      </main>
    </Shell>
  );
}
