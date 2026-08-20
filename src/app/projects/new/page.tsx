import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { listClients } from '@/lib/services/clients';
import { ProjectForm } from '../project-form';

export const metadata: Metadata = { title: 'New project — GTS' };
export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  await requirePermission('projects.create');
  const clients = await listClients();

  return (
    <Shell active="/projects" domain="projects">
      <main className="gts-page">
        <PageHead
          overline="Delivery"
          title="New project"
          lede="A project is the unit everything else hangs off — the employees on site, the stock allocated to it, and the bills raised against it."
        />
        <ProjectForm
          mode="create"
          clients={clients.map((c) => ({ id: c.id, code: c.code, nameEn: c.nameEn }))}
        />
      </main>
    </Shell>
  );
}
