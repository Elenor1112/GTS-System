import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { warehouseDetail } from '@/lib/services/catalogue';
import { t } from '@/lib/i18n';
import { WarehouseForm } from '../../warehouse-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit warehouse — GTS' };

export default async function EditWarehousePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('warehouses.manage');
  const { id } = await params;

  const [warehouse, dict] = await Promise.all([warehouseDetail(id), t()]);
  if (!warehouse) notFound();
  const d = dict.catalogue.warehouses;

  return (
    <Shell active="/storage" domain="inventory">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={`Warehouse · ${warehouse.code}`}
          title={d.edit.title}
          lede={d.edit.lede}
        />
        <div className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <WarehouseForm
            mode="edit"
            dict={d.form}
            values={{
              id: warehouse.id,
              code: warehouse.code,
              nameEn: warehouse.nameEn,
              nameAr: warehouse.nameAr,
              governorateCode: warehouse.governorateCode,
              addressLine: warehouse.addressLine,
              // Decimal, not number: passing these through `toString()`
              // keeps the stored precision instead of rounding a
              // coordinate on its way into the form.
              latitude: warehouse.latitude?.toString() ?? null,
              longitude: warehouse.longitude?.toString() ?? null,
              capacityM3: warehouse.capacityM3?.toString() ?? null,
            }}
          />
        </div>
      </main>
    </Shell>
  );
}
