import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { listClients } from '@/lib/services/clients';
import { t } from '@/lib/i18n';
import { ProjectForm } from '../project-form';

export const metadata: Metadata = { title: 'New project — GTS' };
export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  await requirePermission('projects.create');
  const clients = await listClients();
  const dict = await t();
  const d = dict.operations.projects.newPage;

  return (
    <Shell active="/projects" domain="projects">
      <main className="gts-page">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={d.lede}
        />
        <ProjectForm
          mode="create"
          clients={clients.map((c) => ({ id: c.id, code: c.code, nameEn: c.nameEn }))}
          dict={dict.operations.projects.form}
        />
      </main>
    </Shell>
  );
}
