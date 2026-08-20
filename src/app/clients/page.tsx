import type { Metadata } from 'next';

import { Amount, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listClients } from '@/lib/services/clients';
import { GOVERNORATES } from '@/lib/egypt';
import { TRN } from '@/lib/egypt';

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

  const includeArchived = params.archived === '1';
  const clients = await listClients({ search: params.q, includeArchived });

  const governorate = (code: number | null) =>
    code ? GOVERNORATES.find((g) => g.code === code)?.en ?? '—' : '—';

  const totalOutstanding = clients.reduce((sum, c) => sum + c.outstanding.toNumber(), 0);
  const totalOverdue = clients.reduce((sum, c) => sum + c.overdue.toNumber(), 0);

  return (
    <Shell active="/clients" domain="clients">
      <main className="gts-page">
        <PageHead
          overline="Relationships"
          title="Clients"
          lede={`${clients.length} client${clients.length === 1 ? '' : 's'}${
            totalOutstanding > 0 ? ` · EGP ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })} outstanding` : ''
          }`}
          actions={
            can(actor, 'clients.create') ? (
              <a href="/clients/new" className="gts-btn gts-btn-accent">
                New client
              </a>
            ) : undefined
          }
        />

        {/* Search and filter post as a GET form, so a filtered view is a
            real URL somebody can bookmark or send to a colleague. */}
        <form method="get" className="gts-filter-bar" role="search">
          <div className="gts-field" style={{ flex: '1 1 18rem' }}>
            <label className="gts-sr" htmlFor="q">
              Search clients
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Name, code or tax number"
              className="gts-input"
            />
          </div>
          <label className="gts-check">
            <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} />
            Include archived
          </label>
          <button type="submit" className="gts-btn gts-btn-secondary">
            Search
          </button>
          {(params.q || includeArchived) && (
            <a href="/clients" className="gts-btn gts-btn-ghost">
              Clear
            </a>
          )}
        </form>

        {clients.length === 0 ? (
          <Empty
            title={params.q ? 'No client matches that search' : 'No clients yet'}
            body={
              params.q
                ? 'Try a shorter search, or clear the filter to see everyone.'
                : 'A client owns projects, receives goods and is billed. Create the first one to begin.'
            }
            filtered={Boolean(params.q)}
            action={
              can(actor, 'clients.create') && !params.q ? (
                <a href="/clients/new" className="gts-btn gts-btn-accent">
                  New client
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">
                Clients, with outstanding and overdue balances
              </caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Tax number</th>
                  <th scope="col">Governorate</th>
                  <th scope="col" className="gts-cell-num">Projects</th>
                  <th scope="col" className="gts-cell-num">Outstanding</th>
                  <th scope="col" className="gts-cell-num">Overdue</th>
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
                        {!client.isActive && ' · archived'}
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
                        <Amount value={client.outstanding.toNumber()} size="sm" currency={null} />
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {client.overdue.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Status tone="danger">
                          <Amount value={client.overdue.toNumber()} size="sm" currency={null} />
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
                      Total
                    </th>
                    <td className="gts-cell-num">
                      <Amount value={totalOutstanding} size="sm" currency={null} />
                    </td>
                    <td className="gts-cell-num">
                      {totalOverdue > 0 ? (
                        <Amount value={totalOverdue} size="sm" currency={null} />
                      ) : (
                        <span className="gts-meta">—</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
