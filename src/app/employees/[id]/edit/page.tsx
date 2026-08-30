import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { employeeDetail } from '@/lib/services/people';
import { t } from '@/lib/i18n';
import { EmployeeForm } from '../../employee-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const employee = await employeeDetail(id);
  return { title: employee ? `Edit ${employee.nameEn} — GTS` : 'Edit employee — GTS' };
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('employees.manage');
  const { id } = await params;

  const employee = await employeeDetail(id);
  if (!employee) notFound();

  const dict = await t();
  const d = dict.people.employees.editPage;

  return (
    <Shell active="/employees" domain="attendance">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead overline={`Employee · ${employee.code}`} title={`${d.editTitle} ${employee.nameEn}`} />
        <EmployeeForm
          mode="edit"
          dict={dict.people.employees.form}
          values={{
            id: employee.id,
            code: employee.code,
            nameEn: employee.nameEn,
            nameAr: employee.nameAr,
            nationalId: employee.nationalId,
            insuranceNo: employee.insuranceNo,
            jobTitleEn: employee.jobTitleEn,
            jobTitleAr: employee.jobTitleAr,
            department: employee.department,
            phone: employee.phone,
            email: employee.email,
            hiredOn: employee.hiredOn.toISOString().slice(0, 10),
            dailyRate: employee.dailyRate ? employee.dailyRate.toString() : null,
          }}
        />
      </main>
    </Shell>
  );
}
