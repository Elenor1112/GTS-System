import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { EmployeeForm } from '../employee-form';

export const metadata: Metadata = { title: 'New employee — GTS' };

export default async function NewEmployeePage() {
  await requirePermission('employees.manage');
  const dict = await t();
  const d = dict.people.employees.newPage;

  return (
    <Shell active="/employees" domain="attendance">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead overline={d.overline} title={d.title} lede={d.lede} />
        <EmployeeForm mode="create" dict={dict.people.employees.form} />
      </main>
    </Shell>
  );
}
