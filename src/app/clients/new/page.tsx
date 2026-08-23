import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { ClientForm } from '../client-form';

export const metadata: Metadata = { title: 'New client — GTS' };

export default async function NewClientPage() {
  // The guard is here, not only on the action: a page nobody may use
  // should not render its form and then refuse the submission.
  await requirePermission('clients.create');
  const dict = await t();
  const d = dict.operations.clients.newPage;

  return (
    <Shell active="/clients" domain="clients">
      <main className="gts-page">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={d.lede}
        />
        <ClientForm mode="create" dict={dict.operations.clients.form} />
      </main>
    </Shell>
  );
}
