import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { t } from '@/lib/i18n';
import { etaPortalUrl } from '@/lib/services/eta-client';
import { loadEtaCodes } from '@/lib/services/eta-codes';
import { receiverFacts } from '@/lib/services/eta-facts';
import { organisation } from '@/lib/services/settings';
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
  searchParams: Promise<{ clientId?: string; vendorId?: string; refreshCodes?: string }>;
}) {
  await requirePermission('bills.create');
  const params = await searchParams;

  const [clients, vendors, projects, products, org, etaCodes, dict] = await Promise.all([
    db.client.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true, code: true, nameEn: true, nameAr: true, trn: true,
        receiverType: true, nationalId: true, foreignId: true, countryCode: true,
        governorateCode: true, regionCity: true, addressLine: true, buildingNumber: true,
      },
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
    organisation(),
    // The taxpayer's approved ETA item codes: the only codes a sales line
    // may carry. `?refreshCodes=1` skips the cache after registering one.
    loadEtaCodes({ refresh: params.refreshCodes === '1' }),
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
          clients={clients.map((c) => ({
            id: c.id,
            label: `${c.nameEn} — ${c.code}`,
            receiver: receiverFacts(c)!,
          }))}
          issuer={org}
          etaCodes={etaCodes}
          etaPortal={etaPortalUrl()}
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
