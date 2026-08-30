'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FormActions, FieldGrid, TextField, Submit, errorFor,
} from '@/components/form';
import type { PeopleDict } from '@/lib/i18n/dict/people';

import { submitCreateEmployee, submitUpdateEmployee } from './actions';

export type EmployeeFormDict = PeopleDict['people']['employees']['form'];

export interface EmployeeFormValues {
  id?: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  nationalId: string | null;
  insuranceNo: string | null;
  jobTitleEn: string;
  jobTitleAr: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  hiredOn: string;
  dailyRate: string | null;
}

export function EmployeeForm({
  mode,
  values,
  dict,
}: {
  mode: 'create' | 'edit';
  values?: EmployeeFormValues;
  dict: EmployeeFormDict;
}) {
  const submit = mode === 'create' ? submitCreateEmployee : submitUpdateEmployee;
  const [state, formAction] = useActionState(submit, null);

  useEffect(() => {
    if (!state?.ok) return;
    // No employee detail page exists yet, so both create and edit land
    // back on the directory — matching how the list already reads.
    window.location.assign('/employees');
  }, [state]);

  const e = (field: string) => errorFor(state, field);

  return (
    <div className="bg-surface rounded-lg border border-line shadow-raised p-6">
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      {mode === 'edit' && values?.id && <input type="hidden" name="employeeId" value={values.id} />}

      <FieldGrid>
        {mode === 'edit' && (
          <TextField
            name="code"
            label={dict.codeLabel}
            hint={dict.codeHint}
            required
            defaultValue={values?.code}
            error={e('code')}
            maxLength={32}
          />
        )}
        <TextField
          name="nameEn"
          label={dict.nameEnLabel}
          required
          defaultValue={values?.nameEn}
          error={e('nameEn')}
          maxLength={200}
        />
        <TextField
          name="nameAr"
          label={dict.nameArLabel}
          defaultValue={values?.nameAr}
          error={e('nameAr')}
          maxLength={200}
        />
        <TextField
          name="jobTitleEn"
          label={dict.jobTitleEnLabel}
          required
          defaultValue={values?.jobTitleEn}
          error={e('jobTitleEn')}
          maxLength={200}
        />
        <TextField
          name="jobTitleAr"
          label={dict.jobTitleArLabel}
          defaultValue={values?.jobTitleAr}
          error={e('jobTitleAr')}
          maxLength={200}
        />
        <TextField
          name="department"
          label={dict.departmentLabel}
          defaultValue={values?.department}
          error={e('department')}
          maxLength={120}
        />
        <TextField
          name="nationalId"
          label={dict.nationalIdLabel}
          hint={dict.nationalIdHint}
          defaultValue={values?.nationalId}
          error={e('nationalId')}
          inputMode="numeric"
          maxLength={14}
        />
        <TextField
          name="insuranceNo"
          label={dict.insuranceNoLabel}
          hint={dict.insuranceNoHint}
          defaultValue={values?.insuranceNo}
          error={e('insuranceNo')}
          inputMode="numeric"
          maxLength={9}
        />
        <TextField
          name="phone"
          label={dict.phoneLabel}
          type="tel"
          defaultValue={values?.phone}
          error={e('phone')}
          placeholder="+20 10 1234 5678"
        />
        <TextField
          name="email"
          label={dict.emailLabel}
          type="email"
          defaultValue={values?.email}
          error={e('email')}
        />
        <TextField
          name="hiredOn"
          label={dict.hiredOnLabel}
          type="date"
          required
          defaultValue={values?.hiredOn}
          error={e('hiredOn')}
        />
        <TextField
          name="dailyRate"
          label={dict.dailyRateLabel}
          hint={dict.dailyRateHint}
          type="number"
          inputMode="decimal"
          defaultValue={values?.dailyRate}
          error={e('dailyRate')}
        />
      </FieldGrid>

      <FormActions>
        <Submit variant="accent" pendingLabel={mode === 'create' ? dict.creating : dict.saving}>
          {mode === 'create' ? dict.createEmployee : dict.saveChanges}
        </Submit>
        <a
          href="/employees"
          className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center gap-2"
        >
          {dict.cancel}
        </a>
      </FormActions>
    </form>
    </div>
  );
}
