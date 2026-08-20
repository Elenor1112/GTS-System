import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { warehouseDetail } from '@/lib/services/catalogue';
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

  const warehouse = await warehouseDetail(id);
  if (!warehouse) notFound();

  return (
    <Shell active="/storage" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline={`Warehouse · ${warehouse.code}`}
          title="Edit warehouse"
          lede="Changing these details does not move any stock. Quantities are the ledger's business."
        />
        <WarehouseForm
          mode="edit"
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
      </main>
    </Shell>
  );
}
