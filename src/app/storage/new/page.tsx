import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { WarehouseForm } from '../warehouse-form';

export const metadata: Metadata = { title: 'New warehouse — GTS' };

export default async function NewWarehousePage() {
  // The guard is here, not only on the action: a page nobody may use
  // should not render its form and then refuse the submission.
  await requirePermission('warehouses.manage');

  return (
    <Shell active="/storage" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline="Operations"
          title="New warehouse"
          lede="A warehouse is where stock physically sits. Nothing can be received until one exists, and every ledger row names the building it moved through."
        />
        <WarehouseForm mode="create" />
      </main>
    </Shell>
  );
}
