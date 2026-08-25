import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { WarehouseForm } from '../warehouse-form';

export const metadata: Metadata = { title: 'New warehouse — GTS' };

export default async function NewWarehousePage() {
  // The guard is here, not only on the action: a page nobody may use
  // should not render its form and then refuse the submission.
  await requirePermission('warehouses.manage');
  const dict = await t();
  const d = dict.catalogue.warehouses;

  return (
    <Shell active="/storage" domain="inventory">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={d.new.overline}
          title={d.new.title}
          lede={d.new.lede}
        />
        <div className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <WarehouseForm mode="create" dict={d.form} />
        </div>
      </main>
    </Shell>
  );
}
