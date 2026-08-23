import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { t } from '@/lib/i18n';
import { VendorForm } from '../../vendor-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vendor = await db.vendor.findUnique({ where: { id }, select: { nameEn: true } });
  return { title: vendor ? `Edit ${vendor.nameEn} — GTS` : 'Edit vendor — GTS' };
}

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('vendors.edit');
  const { id } = await params;

  const [vendor, dict] = await Promise.all([
    db.vendor.findFirst({ where: { id, deletedAt: null } }),
    t(),
  ]);
  if (!vendor) notFound();
  const d = dict.catalogue.vendors;

  return (
    <Shell active="/vendors" domain="vendors">
      <main className="gts-page">
        <PageHead overline={`Vendor · ${vendor.code}`} title={`${d.edit.editPrefix} ${vendor.nameEn}`} />
        <VendorForm
          mode="edit"
          dict={d.form}
          values={{
            id: vendor.id,
            code: vendor.code,
            nameEn: vendor.nameEn,
            nameAr: vendor.nameAr,
            trn: vendor.trn,
            commercialRegNo: vendor.commercialRegNo,
            governorateCode: vendor.governorateCode,
            addressLine: vendor.addressLine,
            contactName: vendor.contactName,
            contactPhone: vendor.contactPhone,
            contactEmail: vendor.contactEmail,
            paymentTermsDays: vendor.paymentTermsDays,
            notes: vendor.notes,
          }}
        />
      </main>
    </Shell>
  );
}
