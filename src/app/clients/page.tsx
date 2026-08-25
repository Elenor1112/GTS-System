import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listClients } from '@/lib/services/clients';
import { GOVERNORATES } from '@/lib/egypt';
import { TRN } from '@/lib/egypt';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/preferences';

export const metadata: Metadata = { title: 'Clients — GTS' };
export const dynamic = 'force-dynamic';

/**
 * CLIENTS — the directory.
 *
 * A table rather than cards: the questions asked of this screen are
 * comparative ("who owes us the most", "who is overdue"), and comparison
 * needs aligned columns. The outstanding and overdue figures are real
 * balances derived from the bill rows, not a stored field.
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const actor = await requirePermission('clients.view');
  const params = await searchParams;
  const dict = await t();
  const locale = await getLocale();
  const d = dict.operations.clients.list;

  const includeArchived = params.archived === '1';
  const clients = await listClients({ search: params.q, includeArchived });

  const governorate = (code: number | null) =>
    code ? GOVERNORATES.find((g) => g.code === code)?.en ?? '—' : '—';

  const totalOutstanding = clients.reduce((sum, c) => sum + c.outstanding.toNumber(), 0);
  const totalOverdue = clients.reduce((sum, c) => sum + c.overdue.toNumber(), 0);

  return (
    <Shell active="/clients" domain="clients">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={`${clients.length} ${clients.length === 1 ? d.count_one : d.count_other}${
            totalOutstanding > 0 ? ` · ${formatMoney(totalOutstanding, locale)} ${d.outstandingSuffix}` : ''
          }`}
          actions={
            can(actor, 'clients.create') ? (
              <a
                href="/clients/new"
                className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Icon name="add" />
                {d.newClient}
              </a>
            ) : undefined
          }
        />

        {/* Search and filter post as a GET form, so a filtered view is a
            real URL somebody can bookmark or send to a colleague. */}
        <form method="get" className="bg-surface rounded-lg border border-line shadow-raised p-4 flex flex-wrap items-center gap-3" role="search">
          <div className="flex-1 min-w-[16rem]">
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
          <label className="inline-flex items-center gap-2 text-sm text-fg-secondary h-touch">
            <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="accent-brand" />
            {d.includeArchived}
          </label>
          <button
            type="submit"
            className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors"
          >
            {d.search}
          </button>
          {(params.q || includeArchived) && (
            <a href="/clients" className="h-touch px-4 inline-flex items-center text-sm font-medium text-fg-secondary hover:text-fg transition-colors">
              {d.clear}
            </a>
          )}
        </form>

        {clients.length === 0 ? (
          <div className="bg-surface rounded-lg border border-line shadow-raised">
            <Empty
              title={params.q ? d.emptyNoMatchTitle : d.emptyNoneTitle}
              body={params.q ? d.emptyNoMatchBody : d.emptyNoneBody}
              filtered={Boolean(params.q)}
              action={
                can(actor, 'clients.create') && !params.q ? (
                  <a
                    href="/clients/new"
                    className="h-touch px-4 bg-brand text-fg-on-accent rounded-sm inline-flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    <Icon name="add" />
                    {d.newClient}
                  </a>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-line shadow-raised overflow-hidden">
            <div className="gts-table-scroll">
              <table className="gts-table gts-table-comfortable">
                <caption className="gts-sr">
                  {d.caption}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{d.colClient}</th>
                    <th scope="col">{d.colTaxNumber}</th>
                    <th scope="col">{d.colGovernorate}</th>
                    <th scope="col" className="gts-cell-num">{d.colProjects}</th>
                    <th scope="col" className="gts-cell-num">{d.colOutstanding}</th>
                    <th scope="col" className="gts-cell-num">{d.colOverdue}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <th scope="row">
                        <a href={`/clients/${client.id}`} className="gts-cell-link">
                          {client.nameEn}
                        </a>
                        <span className="gts-meta gts-cell-sub">
                          {client.code}
                          {!client.isActive && ` · ${d.archived}`}
                        </span>
                      </th>
                      <td>
                        {/* Latin digits stay LTR-isolated so the number keeps
                            its reading order when the page flips to Arabic. */}
                        <bdi className="gts-num gts-num-sm">
                          {client.trn ? TRN.format(client.trn) : '—'}
                        </bdi>
                      </td>
                      <td>{governorate(client.governorateCode)}</td>
                      <td className="gts-cell-num">
                        <span className="gts-num gts-num-sm">{client.projectCount}</span>
                      </td>
                      <td className="gts-cell-num">
                        {client.outstanding.isZero() ? (
                          <span className="gts-meta">—</span>
                        ) : (
                          <Amount value={client.outstanding.toNumber()} size="sm" currency={null} locale={locale} />
                        )}
                      </td>
                      <td className="gts-cell-num">
                        {client.overdue.isZero() ? (
                          <span className="gts-meta">—</span>
                        ) : (
                          <Status tone="danger">
                            <Amount value={client.overdue.toNumber()} size="sm" currency={null} locale={locale} />
                          </Status>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totalOutstanding > 0 && (
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={4}>
                        {d.total}
                      </th>
                      <td className="gts-cell-num">
                        <Amount value={totalOutstanding} size="sm" currency={null} locale={locale} />
                      </td>
                      <td className="gts-cell-num">
                        {totalOverdue > 0 ? (
                          <Amount value={totalOverdue} size="sm" currency={null} locale={locale} />
                        ) : (
                          <span className="gts-meta">—</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
