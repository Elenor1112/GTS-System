import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Amount, Region, Status } from '@/components/primitives';
import { Shell, PageHead, Empty } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { outstandingOf, canTransition } from '@/lib/services/billing';
import { organisation } from '@/lib/services/settings';
import { daysOverdue } from '@/lib/services/accounts';
import { formatDate } from '@/lib/format';
import { CURRENCY, TRN, GOVERNORATES, VAT_STANDARD } from '@/lib/egypt';
import { SUBMISSION_LABELS, type EtaSubmissionStatus } from '@/lib/eta';
import { t, type Dictionary } from '@/lib/i18n';
import { getLocale, type Locale } from '@/lib/preferences';

import { BillWorkflow, PaymentForm } from './bill-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bill = await db.electronicBill.findUnique({ where: { id }, select: { number: true } });
  return { title: bill ? `${bill.number} — GTS` : 'Bill — GTS' };
}

/**
 * BILL — the tax document.
 *
 * Laid out as the document it is, because that is what a client reads
 * and what a tax inspector checks: both parties with their registration
 * numbers, the lines, the per-line VAT, the total, and withholding shown
 * BELOW the total because it reduces the cash collected rather than the
 * amount invoiced.
 *
 * The ETA panel reports what is true. There is no transmission
 * integration — that needs taxpayer credentials and an e-seal
 * certificate — so it says "not submitted" rather than inventing a UUID.
 */
export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('bills.view');
  const { id } = await params;

  const [bill, org, dict, locale] = await Promise.all([
    db.electronicBill.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        client: true,
        vendor: true,
        project: { select: { id: true, code: true, nameEn: true } },
        payments: {
          select: {
            id: true, ref: true, amount: true, whtDeducted: true,
            method: true, receivedOn: true, reference: true,
            recordedBy: { select: { nameEn: true } },
          },
          orderBy: { receivedOn: 'desc' },
        },
        approvals: {
          select: {
            id: true, action: true, fromStatus: true, toStatus: true,
            note: true, createdAt: true,
            actor: { select: { nameEn: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    organisation(),
    t(),
    getLocale(),
  ]);

  if (!bill) notFound();

  const d = dict.finance.bills.detail;
  const statusLabel = (status: string) =>
    dict.finance.bills.status[
      status
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof typeof dict.finance.bills.status
    ] ?? status.toLowerCase().replace('_', ' ');
  const actionLabel = (action: string) =>
    d.history.actions[
      action
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof typeof d.history.actions
    ] ?? action.toLowerCase();
  const counterparty = bill.client ?? bill.vendor;
  const outstanding = outstandingOf(bill);
  const late = bill.status === 'OVERDUE' ? daysOverdue(bill.dueOn) : 0;
  const governorate = (code: number | null) =>
    code ? GOVERNORATES.find((g) => g.code === code)?.en ?? '' : '';

  /* Which transitions this actor may actually take, right now. */
  const canSubmit = can(actor, 'bills.edit') && canTransition(bill.status, 'PENDING_APPROVAL');
  const canApprove = can(actor, 'bills.approve') && canTransition(bill.status, 'APPROVED');
  const canSend = can(actor, 'bills.send') && canTransition(bill.status, 'SENT');
  const canCancel = can(actor, 'bills.cancel') && canTransition(bill.status, 'CANCELLED');
  const canPay =
    can(actor, 'payments.record') &&
    outstanding.greaterThan(0) &&
    !['DRAFT', 'PENDING_APPROVAL', 'CANCELLED'].includes(bill.status);

  return (
    <Shell active="/bills" domain="finance">
      <main className="gts-page">
        <PageHead
          overline={`${bill.direction === 'RECEIVABLE' ? d.taxInvoice : d.purchaseBill} · ${
            bill.project?.code ?? d.noProject
          }`}
          title={bill.number}
          lede={counterparty?.nameEn}
          actions={
            <>
              <Status tone={billTone(bill.status)}>
                {statusLabel(bill.status)}
                {late > 0 && ` · ${late} ${d.daysSuffix}`}
              </Status>
              {bill.status === 'DRAFT' && can(actor, 'bills.edit') && (
                <a href={`/bills/${bill.id}/edit`} className="gts-btn gts-btn-secondary">
                  {d.editLines}
                </a>
              )}
              {/* Printing is a real requirement: an Egyptian client
                  expects a document, and print styles are already in the
                  design system. */}
              <a href={`/bills/${bill.id}/print`} className="gts-btn gts-btn-primary">
                {d.print}
              </a>
            </>
          }
        />

        {/* ---------- The workflow ---------- */}
        {(canSubmit || canApprove || canSend || canCancel) && (
          <BillWorkflow
            billId={bill.id}
            number={bill.number}
            canSubmit={canSubmit}
            canApprove={canApprove}
            canSend={canSend}
            canCancel={canCancel}
            dict={dict.finance.bills.workflow}
          />
        )}

        {/* ---------- The parties ---------- */}
        <Region title={d.parties}>
          <div className="gts-grid-editorial">
            <div>
              <p className="gts-overline">
                {bill.direction === 'RECEIVABLE' ? d.issuedBy : d.issuedTo}
              </p>
              <p className="gts-list-title" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
                {org.nameEn}
              </p>
              <p className="gts-meta">
                {org.trn ? (
                  <>
                    {TRN.labelEn} <bdi className="gts-num">{TRN.format(org.trn)}</bdi>
                  </>
                ) : (
                  // Honest rather than blank: an invoice without the
                  // issuer's TRN is not a valid Egyptian tax document.
                  <Status tone="warning">{d.noTrnOrg}</Status>
                )}
              </p>
              {org.addressLine && <p className="gts-meta">{org.addressLine}</p>}
            </div>

            <div>
              <p className="gts-overline">
                {bill.direction === 'RECEIVABLE' ? d.issuedTo : d.issuedBy}
              </p>
              <p className="gts-list-title" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
                {counterparty?.nameEn}
              </p>
              <p className="gts-meta">
                {counterparty?.trn ? (
                  <>
                    {TRN.labelEn} <bdi className="gts-num">{TRN.format(counterparty.trn)}</bdi>
                  </>
                ) : (
                  <Status tone="warning">{d.noTrn}</Status>
                )}
              </p>
              {counterparty?.addressLine && (
                <p className="gts-meta">
                  {counterparty.addressLine}
                  {governorate(counterparty.governorateCode) &&
                    ` · ${governorate(counterparty.governorateCode)}`}
                </p>
              )}
            </div>
          </div>

          <div className="gts-stat-row" style={{ marginBlockStart: 'var(--gts-space-6)' }}>
            <div className="gts-stat">
              <p className="gts-overline">{d.issued}</p>
              <p className="gts-stat-value">{formatDate(bill.issuedOn.toISOString(), locale)}</p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">{d.due}</p>
              <p className="gts-stat-value">{formatDate(bill.dueOn.toISOString(), locale)}</p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">{d.currency}</p>
              <p className="gts-stat-value">{bill.currency}</p>
            </div>
            {bill.project && (
              <div className="gts-stat">
                <p className="gts-overline">{d.project}</p>
                <p className="gts-stat-value">
                  <a href={`/projects/${bill.project.id}`} className="gts-cell-link">
                    {bill.project.code}
                  </a>
                </p>
              </div>
            )}
          </div>
        </Region>

        {/* ---------- The lines ---------- */}
        <Region title={d.lines(bill.items.length)}>
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">
                {d.table.caption}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{d.table.description}</th>
                  <th scope="col">{d.table.itemCode}</th>
                  <th scope="col" className="gts-cell-num">{d.table.qty}</th>
                  <th scope="col" className="gts-cell-num">{d.table.unitPrice}</th>
                  <th scope="col" className="gts-cell-num">{d.table.discount}</th>
                  <th scope="col" className="gts-cell-num">{d.table.net}</th>
                  <th scope="col" className="gts-cell-num">{d.table.vat}</th>
                  <th scope="col" className="gts-cell-num">{d.table.total}</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      {item.descriptionEn}
                      {item.descriptionAr && (
                        <span className="gts-meta gts-cell-sub" lang="ar">
                          {item.descriptionAr}
                        </span>
                      )}
                    </th>
                    <td>
                      {/* Latin codes stay separable when the paragraph
                          direction flips to RTL. */}
                      <bdi className="gts-num gts-num-sm">{item.itemCode ?? '—'}</bdi>
                      {item.gpcCode ? (
                        <span className="gts-meta gts-cell-sub">
                          GPC <bdi>{item.gpcCode}</bdi>
                        </span>
                      ) : (
                        <span className="gts-meta gts-cell-sub">
                          <Status tone="warning">{d.table.noGpcCode}</Status>
                        </span>
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {item.quantity.toString()}
                      <span className="gts-meta gts-cell-sub">{item.unit}</span>
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.unitPrice.toNumber()} size="sm" currency={null} locale={locale} />
                    </td>
                    <td className="gts-cell-num">
                      {item.discount.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Amount value={item.discount.toNumber()} size="sm" currency={null} locale={locale} />
                      )}
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.lineNet.toNumber()} size="sm" currency={null} locale={locale} />
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.lineVat.toNumber()} size="sm" currency={null} locale={locale} />
                      <span className="gts-meta gts-cell-sub">{item.vatRate.toString()}%</span>
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.lineTotal.toNumber()} size="sm" currency={null} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------- The totals ----------
              VAT accumulates per line, so a document mixing 14% goods
              with zero-rated exports computes correctly. */}
          <div className="gts-totals">
            <Line label={d.totals.subtotal} value={bill.subtotal.toNumber()} locale={locale} />
            {bill.discount.greaterThan(0) && (
              <Line label={d.totals.discount} value={-bill.discount.toNumber()} locale={locale} />
            )}
            <Line label={d.totals.net} value={bill.net.toNumber()} locale={locale} />
            <Line label={d.totals.vat} value={bill.vatAmount.toNumber()} locale={locale} />
            <Line label={d.totals.total} value={bill.total.toNumber()} emphasis locale={locale} />

            {bill.whtAmount.greaterThan(0) && (
              <>
                <p className="gts-totals-note">
                  {d.totals.withholdingNote}
                </p>
                <Line
                  label={d.totals.withheldAt(bill.whtRate.toString())}
                  value={-bill.whtAmount.toNumber()}
                  locale={locale}
                />
                <Line
                  label={d.totals.netPayable}
                  value={bill.total.minus(bill.whtAmount).toNumber()}
                  emphasis
                  locale={locale}
                />
              </>
            )}

            {bill.paidAmount.greaterThan(0) && (
              <Line label={d.totals.paid} value={-bill.paidAmount.toNumber()} locale={locale} />
            )}
            {outstanding.greaterThan(0) && (
              <Line label={d.totals.outstanding} value={outstanding.toNumber()} emphasis locale={locale} />
            )}
          </div>
        </Region>

        {/* ---------- Payments ---------- */}
        {can(actor, 'payments.view') && (
          <Region title={d.payments.title(bill.payments.length)}>
            {canPay && (
              <PaymentForm
                billId={bill.id}
                outstanding={outstanding.toString()}
                suggestedWht={bill.whtAmount.toString()}
                dict={(({ title: _title, ...rest }) => rest)(dict.finance.bills.detail.payments)}
                paymentMethods={dict.finance.bills.paymentMethods}
                statuses={dict.finance.bills.status}
              />
            )}

            {bill.payments.length === 0 ? (
              <Empty
                title={d.payments.nothingYetTitle}
                body={
                  bill.status === 'DRAFT' || bill.status === 'PENDING_APPROVAL'
                    ? d.payments.nothingYetBodyLocked
                    : d.payments.nothingYetBody
                }
              />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">{d.payments.table.reference}</th>
                      <th scope="col">{d.payments.table.received}</th>
                      <th scope="col">{d.payments.table.method}</th>
                      <th scope="col">{d.payments.table.recordedBy}</th>
                      <th scope="col" className="gts-cell-num">{d.payments.table.amount}</th>
                      <th scope="col" className="gts-cell-num">{d.payments.table.withheld}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.payments.map((payment) => (
                      <tr key={payment.id}>
                        <th scope="row">
                          <bdi>{payment.ref}</bdi>
                          {payment.reference && (
                            <span className="gts-meta gts-cell-sub">{payment.reference}</span>
                          )}
                        </th>
                        <td>{formatDate(payment.receivedOn.toISOString(), locale)}</td>
                        <td>{paymentMethodLabel(payment.method, dict)}</td>
                        <td>{payment.recordedBy.nameEn}</td>
                        <td className="gts-cell-num">
                          <Amount value={payment.amount.toNumber()} size="sm" currency={null} locale={locale} />
                        </td>
                        <td className="gts-cell-num">
                          {payment.whtDeducted.isZero() ? (
                            <span className="gts-meta">—</span>
                          ) : (
                            <Amount value={payment.whtDeducted.toNumber()} size="sm" currency={null} locale={locale} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Region>
        )}

        {/* ---------- Approval history ---------- */}
        <Region title={d.history.title}>
          {bill.approvals.length === 0 ? (
            <Empty
              title={d.history.emptyTitle}
              body={d.history.emptyBody}
            />
          ) : (
            <ol className="gts-timeline">
              {bill.approvals.map((entry) => (
                <li key={entry.id} className="gts-timeline-row" data-kind={entry.action}>
                  <span className="gts-timeline-dot" aria-hidden="true" />
                  <div className="gts-timeline-body">
                    <p className="gts-timeline-title">
                      {actionLabel(entry.action)} {d.history.by} {entry.actor.nameEn}
                    </p>
                    <p className="gts-meta">
                      {statusLabel(entry.fromStatus)} →{' '}
                      {statusLabel(entry.toStatus)}
                      {entry.note && ` · ${entry.note}`}
                    </p>
                  </div>
                  <div className="gts-timeline-aside">
                    <span className="gts-meta">{formatDate(entry.createdAt.toISOString(), locale)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Region>

        {/* ---------- The ETA ---------- */}
        <Region title={d.eta.title}>
          <div className="gts-stat-row">
            <div className="gts-stat">
              <p className="gts-overline">{d.eta.submission}</p>
              <p className="gts-stat-value">
                <Status tone={bill.etaStatus === 'VALID' ? 'success' : 'neutral'}>
                  {SUBMISSION_LABELS[bill.etaStatus as EtaSubmissionStatus]?.[locale] ?? bill.etaStatus}
                </Status>
              </p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">{d.eta.documentUuid}</p>
              <p className="gts-stat-value">
                {bill.etaUuid ? (
                  <bdi className="gts-num gts-num-sm">{bill.etaUuid}</bdi>
                ) : (
                  <span className="gts-meta">—</span>
                )}
              </p>
            </div>
          </div>
          <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-4)' }}>
            {d.eta.disclaimer}
          </p>
        </Region>
      </main>
    </Shell>
  );
}

/** One line of the totals block. */
function Line({
  label,
  value,
  emphasis = false,
  locale,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  locale: Locale;
}) {
  return (
    <div className={emphasis ? 'gts-totals-row gts-totals-row-strong' : 'gts-totals-row'}>
      <span className={emphasis ? 'gts-totals-label-strong' : 'gts-totals-label'}>{label}</span>
      <Amount value={value} size={emphasis ? 'md' : 'sm'} currency={CURRENCY.mark} locale={locale} />
    </div>
  );
}

/** Payment methods carry only an English label in their module (client
 *  strings live outside i18n's server-only `t()`); this maps the enum
 *  value to the dictionary's translated label for the current locale. */
function paymentMethodLabel(method: string, dict: Dictionary) {
  const key = method.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as
    keyof typeof dict.finance.bills.paymentMethods;
  return dict.finance.bills.paymentMethods[key] ?? method.toLowerCase().replace('_', ' ');
}

function billTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'OVERDUE') return 'danger' as const;
  if (status === 'PARTIALLY_PAID' || status === 'PENDING_APPROVAL') return 'warning' as const;
  if (status === 'CANCELLED' || status === 'DRAFT') return 'neutral' as const;
  return 'info' as const;
}
