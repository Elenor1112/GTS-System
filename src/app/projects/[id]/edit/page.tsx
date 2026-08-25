import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { projectDetail } from '@/lib/services/projects';
import { listClients } from '@/lib/services/clients';
import { t } from '@/lib/i18n';
import { ProjectForm } from '../../project-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit project — GTS' };

/** A date column renders into <input type="date">, which wants YYYY-MM-DD. */
const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('projects.edit');
  const { id } = await params;

  const [project, clients] = await Promise.all([projectDetail(id), listClients()]);
  if (!project) notFound();

  const dict = await t();
  const d = dict.operations.projects.editPage;

  return (
    <Shell active="/projects" domain="projects">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={`Project · ${project.code}`}
          title={d.title}
          lede={d.lede}
        />
        <div className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <ProjectForm
            mode="edit"
            clients={clients.map((c) => ({ id: c.id, code: c.code, nameEn: c.nameEn }))}
            dict={dict.operations.projects.form}
            values={{
              id: project.id,
              code: project.code,
              nameEn: project.nameEn,
              nameAr: project.nameAr,
              clientId: project.clientId,
              status: project.status,
              startsOn: dateInput(project.startsOn),
              endsOn: dateInput(project.endsOn),
              budget: project.budget?.toString() ?? null,
              notes: project.notes,
            }}
          />
        </div>
      </main>
    </Shell>
  );
}
