import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { VendorForm } from '../vendor-form';

export const metadata: Metadata = { title: 'New vendor — GTS' };

export default async function NewVendorPage() {
  // The guard is here, not only on the action: a page nobody may use
  // should not render its form and then refuse the submission.
  await requirePermission('vendors.create');
  const dict = await t();
  const d = dict.catalogue.vendors;

  return (
    <Shell active="/vendors" domain="vendors">
      <main className="gts-page">
        <PageHead
          overline={d.new.overline}
          title={d.new.title}
          lede={d.new.lede}
        />
        <VendorForm mode="create" dict={d.form} />
      </main>
    </Shell>
  );
}
