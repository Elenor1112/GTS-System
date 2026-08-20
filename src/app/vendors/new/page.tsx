import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { VendorForm } from '../vendor-form';

export const metadata: Metadata = { title: 'New vendor — GTS' };

export default async function NewVendorPage() {
  // The guard is here, not only on the action: a page nobody may use
  // should not render its form and then refuse the submission.
  await requirePermission('vendors.create');

  return (
    <Shell active="/vendors" domain="vendors">
      <main className="gts-page">
        <PageHead
          overline="Relationships"
          title="New vendor"
          lede="A vendor supplies the products you receive into your warehouses. Their tax registration number is what makes the bills they send you deductible."
        />
        <VendorForm mode="create" />
      </main>
    </Shell>
  );
}
