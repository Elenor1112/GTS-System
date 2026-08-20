import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listProjects } from '@/lib/services/projects';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Projects — GTS' };
export const dynamic = 'force-dynamic';

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;

/**
 * PROJECTS — the operational spine.
 *
 * A project is where the client, the site, the people and the materials
 * meet. The list leads with whether each one has a pinned location,
 * because a project without coordinates is one nobody can check in at —
 * an operational fault, not a cosmetic gap.
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await requirePermission('projects.view');
  const params = await searchParams;

  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;

  const projects = await listProjects({ search: params.q, status });
  const unpinned = projects.filter((p) => !p.location && p.status === 'ACTIVE').length;

  return (
    <Shell active="/projects" domain="projects">
      <main className="gts-page">
        <PageHead
          overline="Operations"
          title="Projects"
          lede={`${projects.length} project${projects.length === 1 ? '' : 's'}${
            unpinned > 0
              ? ` · ${unpinned} active without a pinned site, so nobody can check in there`
              : ''
          }`}
          actions={
            can(actor, 'projects.create') ? (
              <a href="/projects/new" className="gts-btn gts-btn-accent">
                New project
              </a>
            ) : undefined
          }
        />

        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 16rem' }}>
            <label className="gts-sr" htmlFor="q">
              Search projects
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Project, code or client"
              className="gts-input"
            />
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={status ?? ''} className="gts-input gts-select">
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase().replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="gts-btn gts-btn-secondary">
            Filter
          </button>
          {(params.q || status) && (
            <a href="/projects" className="gts-btn gts-btn-ghost">
              Clear
            </a>
          )}
        </form>

        {projects.length === 0 ? (
          <Empty
            title={params.q || status ? 'No project matches' : 'No projects yet'}
            body={
              params.q || status
                ? 'Try a different search, or clear the filter.'
                : 'A project carries a client, a site location, the people assigned to it and the materials allocated to it.'
            }
            filtered={Boolean(params.q || status)}
            action={
              can(actor, 'projects.create') && !params.q && !status ? (
                <a href="/projects/new" className="gts-btn gts-btn-accent">
                  New project
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">Projects, their sites and budget consumption</caption>
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col">Site</th>
                  <th scope="col" className="gts-cell-num">Team</th>
                  <th scope="col" className="gts-cell-num">Billed</th>
                  <th scope="col" className="gts-cell-num">Of budget</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <th scope="row">
                      <a href={`/projects/${project.id}`} className="gts-cell-link">
                        {project.nameEn}
                      </a>
                      <span className="gts-meta gts-cell-sub">
                        {project.code}
                        {project.startsOn && ` · from ${formatDate(project.startsOn.toISOString())}`}
                      </span>
                    </th>
                    <td>
                      <a href={`/clients/${project.client.id}`} className="gts-cell-link">
                        {project.client.nameEn}
                      </a>
                    </td>
                    <td>
                      <Status tone={statusTone(project.status)}>
                        {project.status.toLowerCase().replace('_', ' ')}
                      </Status>
                    </td>
                    <td>
                      {project.location ? (
                        <a
                          href={`https://www.google.com/maps/@${project.location.latitude},${project.location.longitude},17z`}
                          target="_blank"
                          rel="noreferrer"
                          className="gts-cell-link"
                        >
                          {project.location.addressLine}
                          <span className="gts-meta gts-cell-sub">
                            {project.location.radiusMetres}m fence
                          </span>
                        </a>
                      ) : (
                        // Not a cosmetic gap: without coordinates there is
                        // no fence, and nobody assigned here can attend.
                        <Status tone="warning">No site pinned</Status>
                      )}
                    </td>
                    <td className="gts-cell-num">
                      <span className="gts-num gts-num-sm">{project._count.employees}</span>
                    </td>
                    <td className="gts-cell-num">
                      {project.billed.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Amount value={project.billed.toNumber()} size="sm" currency={null} />
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {project.consumedPct === null ? (
                        <span className="gts-meta">no budget</span>
                      ) : (
                        <span
                          className={`gts-num gts-num-sm${project.consumedPct > 100 ? ' gts-num-negative' : ''}`}
                        >
                          {project.consumedPct}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'COMPLETED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'ON_HOLD') return 'warning' as const;
  return 'neutral' as const;
}
