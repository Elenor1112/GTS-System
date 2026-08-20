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

  const [bill, org] = await Promise.all([
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
  ]);

  if (!bill) notFound();

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
          overline={`${bill.direction === 'RECEIVABLE' ? 'Tax invoice' : 'Purchase bill'} · ${
            bill.project?.code ?? 'No project'
          }`}
          title={bill.number}
          lede={counterparty?.nameEn}
          actions={
            <>
              <Status tone={billTone(bill.status)}>
                {bill.status.toLowerCase().replace('_', ' ')}
                {late > 0 && ` · ${late} days`}
              </Status>
              {bill.status === 'DRAFT' && can(actor, 'bills.edit') && (
                <a href={`/bills/${bill.id}/edit`} className="gts-btn gts-btn-secondary">
                  Edit lines
                </a>
              )}
              {/* Printing is a real requirement: an Egyptian client
                  expects a document, and print styles are already in the
                  design system. */}
              <a href={`/bills/${bill.id}/print`} className="gts-btn gts-btn-primary">
                Print
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
          />
        )}

        {/* ---------- The parties ---------- */}
        <Region title="Parties">
          <div className="gts-grid-editorial">
            <div>
              <p className="gts-overline">
                {bill.direction === 'RECEIVABLE' ? 'Issued by' : 'Issued to'}
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
                  <Status tone="warning">No tax registration number set — see Administration</Status>
                )}
              </p>
              {org.addressLine && <p className="gts-meta">{org.addressLine}</p>}
            </div>

            <div>
              <p className="gts-overline">
                {bill.direction === 'RECEIVABLE' ? 'Issued to' : 'Issued by'}
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
                  <Status tone="warning">No tax registration number</Status>
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
              <p className="gts-overline">Issued</p>
              <p className="gts-stat-value">{formatDate(bill.issuedOn.toISOString())}</p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">Due</p>
              <p className="gts-stat-value">{formatDate(bill.dueOn.toISOString())}</p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">Currency</p>
              <p className="gts-stat-value">{bill.currency}</p>
            </div>
            {bill.project && (
              <div className="gts-stat">
                <p className="gts-overline">Project</p>
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
        <Region title={`Lines (${bill.items.length})`}>
          <div className="gts-table-scroll">
            <table className="gts-table gts-table-comfortable">
              <caption className="gts-sr">
                Line items, each with its own VAT rate
              </caption>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">Item code</th>
                  <th scope="col" className="gts-cell-num">Qty</th>
                  <th scope="col" className="gts-cell-num">Unit price</th>
                  <th scope="col" className="gts-cell-num">Discount</th>
                  <th scope="col" className="gts-cell-num">Net</th>
                  <th scope="col" className="gts-cell-num">VAT</th>
                  <th scope="col" className="gts-cell-num">Total</th>
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
                          <Status tone="warning">No GPC code</Status>
                        </span>
                      )}
                    </td>
                    <td className="gts-cell-num">
                      {item.quantity.toString()}
                      <span className="gts-meta gts-cell-sub">{item.unit}</span>
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.unitPrice.toNumber()} size="sm" currency={null} />
                    </td>
                    <td className="gts-cell-num">
                      {item.discount.isZero() ? (
                        <span className="gts-meta">—</span>
                      ) : (
                        <Amount value={item.discount.toNumber()} size="sm" currency={null} />
                      )}
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.lineNet.toNumber()} size="sm" currency={null} />
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.lineVat.toNumber()} size="sm" currency={null} />
                      <span className="gts-meta gts-cell-sub">{item.vatRate.toString()}%</span>
                    </td>
                    <td className="gts-cell-num">
                      <Amount value={item.lineTotal.toNumber()} size="sm" currency={null} />
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
            <Line label="Subtotal" value={bill.subtotal.toNumber()} />
            {bill.discount.greaterThan(0) && (
              <Line label="Discount" value={-bill.discount.toNumber()} />
            )}
            <Line label="Net" value={bill.net.toNumber()} />
            <Line label={`VAT`} value={bill.vatAmount.toNumber()} />
            <Line label="Total" value={bill.total.toNumber()} emphasis />

            {bill.whtAmount.greaterThan(0) && (
              <>
                <p className="gts-totals-note">
                  Withholding tax is deducted by the buyer at payment and remitted to the ETA on
                  our behalf. It reduces the cash received — never the invoice total.
                </p>
                <Line
                  label={`Withheld at ${bill.whtRate.toString()}%`}
                  value={-bill.whtAmount.toNumber()}
                />
                <Line
                  label="Net payable"
                  value={bill.total.minus(bill.whtAmount).toNumber()}
                  emphasis
                />
              </>
            )}

            {bill.paidAmount.greaterThan(0) && (
              <Line label="Paid" value={-bill.paidAmount.toNumber()} />
            )}
            {outstanding.greaterThan(0) && (
              <Line label="Outstanding" value={outstanding.toNumber()} emphasis />
            )}
          </div>
        </Region>

        {/* ---------- Payments ---------- */}
        {can(actor, 'payments.view') && (
          <Region title={`Payments (${bill.payments.length})`}>
            {canPay && (
              <PaymentForm
                billId={bill.id}
                outstanding={outstanding.toString()}
                suggestedWht={bill.whtAmount.toString()}
              />
            )}

            {bill.payments.length === 0 ? (
              <Empty
                title="Nothing paid yet"
                body={
                  bill.status === 'DRAFT' || bill.status === 'PENDING_APPROVAL'
                    ? 'A payment cannot be recorded until the bill is approved.'
                    : 'Payments recorded against this bill appear here.'
                }
              />
            ) : (
              <div className="gts-table-scroll">
                <table className="gts-table gts-table-comfortable">
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Received</th>
                      <th scope="col">Method</th>
                      <th scope="col">Recorded by</th>
                      <th scope="col" className="gts-cell-num">Amount</th>
                      <th scope="col" className="gts-cell-num">Withheld</th>
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
                        <td>{formatDate(payment.receivedOn.toISOString())}</td>
                        <td>{payment.method.toLowerCase().replace('_', ' ')}</td>
                        <td>{payment.recordedBy.nameEn}</td>
                        <td className="gts-cell-num">
                          <Amount value={payment.amount.toNumber()} size="sm" currency={null} />
                        </td>
                        <td className="gts-cell-num">
                          {payment.whtDeducted.isZero() ? (
                            <span className="gts-meta">—</span>
                          ) : (
                            <Amount value={payment.whtDeducted.toNumber()} size="sm" currency={null} />
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
        <Region title="History">
          {bill.approvals.length === 0 ? (
            <Empty
              title="Still a draft"
              body="Every submission, approval, rejection and cancellation is recorded here with who did it."
            />
          ) : (
            <ol className="gts-timeline">
              {bill.approvals.map((entry) => (
                <li key={entry.id} className="gts-timeline-row" data-kind={entry.action}>
                  <span className="gts-timeline-dot" aria-hidden="true" />
                  <div className="gts-timeline-body">
                    <p className="gts-timeline-title">
                      {entry.action.toLowerCase()} by {entry.actor.nameEn}
                    </p>
                    <p className="gts-meta">
                      {entry.fromStatus.toLowerCase().replace('_', ' ')} →{' '}
                      {entry.toStatus.toLowerCase().replace('_', ' ')}
                      {entry.note && ` · ${entry.note}`}
                    </p>
                  </div>
                  <div className="gts-timeline-aside">
                    <span className="gts-meta">{formatDate(entry.createdAt.toISOString())}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Region>

        {/* ---------- The ETA ---------- */}
        <Region title="Egyptian Tax Authority">
          <div className="gts-stat-row">
            <div className="gts-stat">
              <p className="gts-overline">Submission</p>
              <p className="gts-stat-value">
                <Status tone={bill.etaStatus === 'VALID' ? 'success' : 'neutral'}>
                  {SUBMISSION_LABELS[bill.etaStatus as EtaSubmissionStatus]?.en ?? bill.etaStatus}
                </Status>
              </p>
            </div>
            <div className="gts-stat">
              <p className="gts-overline">Document UUID</p>
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
            This document is produced in the ETA&rsquo;s shape — both parties&rsquo; registration
            numbers, GPC item codes and per-line VAT — but it is <strong>not transmitted</strong>.
            Submission requires taxpayer credentials and an e-seal certificate, which are not
            configured. No identifier is shown above because none has been issued.
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
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? 'gts-totals-row gts-totals-row-strong' : 'gts-totals-row'}>
      <span className={emphasis ? 'gts-totals-label-strong' : 'gts-totals-label'}>{label}</span>
      <Amount value={value} size={emphasis ? 'md' : 'sm'} currency={CURRENCY.mark} />
    </div>
  );
}

function billTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'OVERDUE') return 'danger' as const;
  if (status === 'PARTIALLY_PAID' || status === 'PENDING_APPROVAL') return 'warning' as const;
  if (status === 'CANCELLED' || status === 'DRAFT') return 'neutral' as const;
  return 'info' as const;
}
