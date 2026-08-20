import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { projectDetail } from '@/lib/services/projects';
import { listClients } from '@/lib/services/clients';
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

  return (
    <Shell active="/projects" domain="projects">
      <main className="gts-page">
        <PageHead
          overline={`Project · ${project.code}`}
          title="Edit project"
          lede="The site location is set from the project page, not here — it carries its own permission because attendance is checked against it."
        />
        <ProjectForm
          mode="edit"
          clients={clients.map((c) => ({ id: c.id, code: c.code, nameEn: c.nameEn }))}
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
      </main>
    </Shell>
  );
}
