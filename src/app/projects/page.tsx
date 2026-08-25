import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listProjects } from '@/lib/services/projects';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

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
  const dict = await t();
  const locale = await getLocale();
  const d = dict.operations.projects.list;

  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;

  const projects = await listProjects({ search: params.q, status });
  const unpinned = projects.filter((p) => !p.location && p.status === 'ACTIVE').length;

  return (
    <Shell active="/projects" domain="projects">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={`${projects.length} ${projects.length === 1 ? d.count_one : d.count_other}${
            unpinned > 0 ? ` · ${unpinned} ${d.unpinnedWarning}` : ''
          }`}
          actions={
            can(actor, 'projects.create') ? (
              <a
                href="/projects/new"
                className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Icon name="add" />
                {d.newProject}
              </a>
            ) : undefined
          }
        />

        <form method="get" className="bg-surface rounded-lg border border-line shadow-raised p-4 flex flex-wrap items-center gap-3" role="search">
          <div className="flex-1 min-w-[14rem]">
            <label className="gts-sr" htmlFor="q">
              {d.searchLabel}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-fg-muted">
                <Icon name="search" size={20} />
              </span>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={params.q ?? ''}
                placeholder={d.searchPlaceholder}
                className="w-full h-touch ps-10 pe-3 rounded-sm border border-line bg-surface text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="gts-sr" htmlFor="status">
              {d.statusLabel}
            </label>
            <select id="status" name="status" defaultValue={status ?? ''} className="h-touch px-3 rounded-sm border border-line bg-surface text-sm text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none">
              <option value="">{d.anyStatus}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(dict, s)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors"
          >
            {d.filter}
          </button>
          {(params.q || status) && (
            <a href="/projects" className="h-touch px-4 inline-flex items-center text-sm font-medium text-fg-secondary hover:text-fg transition-colors">
              {d.clear}
            </a>
          )}
        </form>

        {projects.length === 0 ? (
          <div className="bg-surface rounded-lg border border-line shadow-raised">
            <Empty
              title={params.q || status ? d.emptyNoMatchTitle : d.emptyNoneTitle}
              body={params.q || status ? d.emptyNoMatchBody : d.emptyNoneBody}
              filtered={Boolean(params.q || status)}
              action={
                can(actor, 'projects.create') && !params.q && !status ? (
                  <a
                    href="/projects/new"
                    className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    <Icon name="add" />
                    {d.newProject}
                  </a>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">{d.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{d.colProject}</th>
                  <th scope="col">{d.colClient}</th>
                  <th scope="col">{d.colStatus}</th>
                  <th scope="col">{d.colSite}</th>
                  <th scope="col">{d.colEnds}</th>
                  <th scope="col" className="gts-cell-num">{d.colTeam}</th>
                  <th scope="col" className="gts-cell-num">{d.colBilled}</th>
                  <th scope="col" className="gts-cell-num">{d.colOfBudget}</th>
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
                        {project.startsOn && ` · ${d.startsFrom} ${formatDate(project.startsOn.toISOString(), locale)}`}
                      </span>
                    </th>
                    <td>
                      <a href={`/clients/${project.client.id}`} className="gts-cell-link">
                        {project.client.nameEn}
                      </a>
                    </td>
                    <td>
                      <Status tone={statusTone(project.status)}>
                        {statusLabel(dict, project.status)}
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
                            {project.location.radiusMetres}{d.siteFence}
                          </span>
                        </a>
                      ) : (
                        // Not a cosmetic gap: without coordinates there is
                        // no fence, and nobody assigned here can attend.
                        <Status tone="warning">{d.noSitePinned}</Status>
                      )}
                    </td>
                    <td>{deadlineCell(project.endsOn, project.status, d, locale)}</td>
                    <td className="gts-cell-num">
                      <span className="gts-num gts-num-sm">{project._count.employees}</span>
                    </td>
                    <td className="gts-cell-num">
                      {project.billed.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Amount value={project.billed.toNumber()} size="sm" currency={null} locale={locale} />
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {project.consumedPct === null ? (
                        <span className="gts-meta">{d.noBudget}</span>
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
          </div>
        )}
      </main>
    </Shell>
  );
}

function statusLabel(dict: Awaited<ReturnType<typeof t>>, status: string) {
  const f = dict.operations.projects.form;
  switch (status) {
    case 'PLANNING': return f.statusPlanning;
    case 'ACTIVE': return f.statusActive;
    case 'ON_HOLD': return f.statusOnHold;
    case 'COMPLETED': return f.statusCompleted;
    case 'CANCELLED': return f.statusCancelled;
    default: return status.toLowerCase().replace('_', ' ');
  }
}

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'COMPLETED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'ON_HOLD') return 'warning' as const;
  return 'neutral' as const;
}

/** A near or past deadline only matters while the project is still running. */
function deadlineCell(
  endsOn: Date | null,
  status: string,
  d: Awaited<ReturnType<typeof t>>['operations']['projects']['list'],
  locale: 'en' | 'ar',
) {
  if (!endsOn) return <span className="gts-meta">—</span>;

  const tracked = status === 'PLANNING' || status === 'ACTIVE';
  const days = Math.round((endsOn.getTime() - Date.now()) / 86_400_000);
  const label = formatDate(endsOn.toISOString(), locale);

  if (!tracked || days > 7) return <span className="gts-meta gts-cell-sub">{label}</span>;

  return (
    <Status tone={days < 0 ? 'danger' : 'warning'}>
      {label}
      <span className="gts-meta gts-cell-sub">
        {days < 0 ? `${Math.abs(days)}${d.overdueSuffix}` : `${days}${d.leftSuffix}`}
      </span>
    </Status>
  );
}
