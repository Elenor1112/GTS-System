import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { ClientForm } from '../../client-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id }, select: { nameEn: true } });
  return { title: client ? `Edit ${client.nameEn} — GTS` : 'Edit client — GTS' };
}

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('clients.edit');
  const { id } = await params;

  const client = await db.client.findFirst({ where: { id, deletedAt: null } });
  if (!client) notFound();

  return (
    <Shell active="/clients" domain="clients">
      <main className="gts-page">
        <PageHead overline={`Client · ${client.code}`} title={`Edit ${client.nameEn}`} />
        <ClientForm
          mode="edit"
          values={{
            id: client.id,
            code: client.code,
            nameEn: client.nameEn,
            nameAr: client.nameAr,
            trn: client.trn,
            commercialRegNo: client.commercialRegNo,
            governorateCode: client.governorateCode,
            addressLine: client.addressLine,
            contactName: client.contactName,
            contactPhone: client.contactPhone,
            contactEmail: client.contactEmail,
            paymentTermsDays: client.paymentTermsDays,
            // Decimal must cross to the client component as a string:
            // a Prisma.Decimal is not serialisable, and Number() would
            // quietly round a large credit limit.
            creditLimit: client.creditLimit.toString(),
            notes: client.notes,
          }}
        />
      </main>
    </Shell>
  );
}
