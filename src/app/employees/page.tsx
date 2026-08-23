import type { Metadata } from 'next';

import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { listEmployees, employeeFilterOptions } from '@/lib/services/people';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

export const metadata: Metadata = { title: 'Employees — GTS' };
export const dynamic = 'force-dynamic';

/**
 * EMPLOYEES — the people directory.
 *
 * Position and department are free text on the model, not a lookup
 * table, so the filter options are drawn from what employees actually
 * carry today rather than a fixed list. The project filter means
 * "assigned right now" — a released assignment does not count, the same
 * predicate attendance and payroll use elsewhere.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; position?: string; department?: string; project?: string; inactive?: string }>;
}) {
  await requirePermission('employees.view');
  const params = await searchParams;
  const dict = await t();
  const locale = await getLocale();

  const includeInactive = params.inactive === '1';
  const [employees, filterOptions] = await Promise.all([
    listEmployees({
      search: params.q,
      jobTitle: params.position || undefined,
      department: params.department || undefined,
      projectId: params.project || undefined,
      includeInactive,
    }),
    employeeFilterOptions(),
  ]);

  const filtered = Boolean(params.q || params.position || params.department || params.project);

  return (
    <Shell active="/employees" domain="attendance">
      <main className="gts-page">
        <PageHead
          overline={dict.people.employees.overline}
          title={dict.people.employees.title}
          lede={dict.people.employees.countLede
            .replace('{count}', String(employees.length))
            .replace('{plural}', employees.length === 1 ? '' : 's')}
        />

        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 16rem' }}>
            <label className="gts-sr" htmlFor="q">
              {dict.people.employees.filters.searchLabel}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder={dict.people.employees.filters.searchPlaceholder}
              className="gts-input"
            />
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="position">
              {dict.people.employees.filters.positionLabel}
            </label>
            <select id="position" name="position" defaultValue={params.position ?? ''} className="gts-input gts-select">
              <option value="">{dict.people.employees.filters.anyPosition}</option>
              {filterOptions.jobTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="department">
              {dict.people.employees.filters.departmentLabel}
            </label>
            <select id="department" name="department" defaultValue={params.department ?? ''} className="gts-input gts-select">
              <option value="">{dict.people.employees.filters.anyDepartment}</option>
              {filterOptions.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div className="gts-field">
            <label className="gts-sr" htmlFor="project">
              {dict.people.employees.filters.projectLabel}
            </label>
            <select id="project" name="project" defaultValue={params.project ?? ''} className="gts-input gts-select">
              <option value="">{dict.people.employees.filters.anyProject}</option>
              {filterOptions.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.nameEn}
                </option>
              ))}
            </select>
          </div>
          <label className="gts-check">
            <input type="checkbox" name="inactive" value="1" defaultChecked={includeInactive} />
            {dict.people.employees.filters.includeInactive}
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            {dict.people.employees.filters.filter}
          </button>
          {(filtered || includeInactive) && (
            <a href="/employees" className="gts-btn gts-btn-ghost">
              {dict.people.employees.filters.clear}
            </a>
          )}
        </form>

        {employees.length === 0 ? (
          <Empty
            title={filtered ? dict.people.employees.empty.noMatchTitle : dict.people.employees.empty.noneYetTitle}
            body={
              filtered
                ? dict.people.employees.empty.filteredBody
                : dict.people.employees.empty.emptyBody
            }
            filtered={filtered}
          />
        ) : (
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">{dict.people.employees.list.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{dict.people.employees.list.employeeHeader}</th>
                  <th scope="col">{dict.people.employees.list.positionHeader}</th>
                  <th scope="col">{dict.people.employees.list.departmentHeader}</th>
                  <th scope="col">{dict.people.employees.list.projectsHeader}</th>
                  <th scope="col">{dict.people.employees.list.hiredHeader}</th>
                  <th scope="col">{dict.people.employees.list.loginHeader}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <th scope="row">
                      {employee.nameEn}
                      <span className="gts-meta gts-cell-sub">{employee.code}</span>
                    </th>
                    <td>{employee.jobTitleEn}</td>
                    <td>{employee.department ?? <span className="gts-meta">—</span>}</td>
                    <td>
                      {employee.projects.length === 0 ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        employee.projects.map((assignment, i) => (
                          <span key={assignment.project.id}>
                            {i > 0 && ', '}
                            <a href={`/projects/${assignment.project.id}`} className="gts-cell-link">
                              {assignment.project.code}
                            </a>
                          </span>
                        ))
                      )}
                    </td>
                    <td>{formatDate(employee.hiredOn.toISOString(), locale)}</td>
                    <td>{employee.user ? employee.user.email : <span className="gts-meta">{dict.people.employees.list.noLogin}</span>}</td>
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
