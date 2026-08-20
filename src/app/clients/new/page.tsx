import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { ClientForm } from '../client-form';

export const metadata: Metadata = { title: 'New client — GTS' };

export default async function NewClientPage() {
  // The guard is here, not only on the action: a page nobody may use
  // should not render its form and then refuse the submission.
  await requirePermission('clients.create');

  return (
    <Shell active="/clients" domain="clients">
      <main className="gts-page">
        <PageHead
          overline="Relationships"
          title="New client"
          lede="A client owns projects, receives goods and is billed. The tax registration number is what makes their invoices valid."
        />
        <ClientForm mode="create" />
      </main>
    </Shell>
  );
}
