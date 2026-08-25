'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FormActions, FieldGrid, TextField, SelectField, TextArea, Submit, errorFor,
} from '@/components/form';
import { GOVERNORATES } from '@/lib/egypt';
import type { OperationsDict } from '@/lib/i18n/dict/operations';

import { submitCreateClient, submitUpdateClient } from './actions';

/**
 * The client form, used for both create and edit.
 *
 * One component rather than two near-identical ones: the only real
 * difference is which action it posts to and whether the fields start
 * populated, and duplicating 120 lines of markup to express that would
 * guarantee the two drift apart.
 */

export type ClientFormDict = OperationsDict['operations']['clients']['form'];

export interface ClientFormValues {
  id?: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  trn: string | null;
  commercialRegNo: string | null;
  governorateCode: number | null;
  addressLine: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTermsDays: number;
  creditLimit: string;
  notes: string | null;
}

export function ClientForm({
  mode,
  values,
  dict,
}: {
  mode: 'create' | 'edit';
  values?: ClientFormValues;
  dict: ClientFormDict;
}) {
  const submit = mode === 'create' ? submitCreateClient : submitUpdateClient;
  const [state, formAction] = useActionState(submit, null);

  useEffect(() => {
    if (!state?.ok) return;

    const id = 'id' in state.data ? (state.data.id as string) : values?.id;
    const target = id ? `/clients/${id}` : '/clients';

    // A full navigation rather than router.push().
    //
    // The destination is a server component that must read the row just
    // written. router.push() serves it from the client router cache,
    // which was populated before the write — so the page renders stale,
    // or empty for a record that did not exist a moment ago. The action
    // already called revalidatePath(); this makes the browser actually
    // fetch that revalidated page.
    window.location.assign(target);
  }, [state, values?.id]);

  const e = (field: string) => errorFor(state, field);

  return (
    <div className="bg-surface rounded-lg border border-line shadow-raised p-6">
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      {mode === 'edit' && values?.id && <input type="hidden" name="clientId" value={values.id} />}

      <FieldGrid>
        <TextField
          name="code"
          label={dict.codeLabel}
          hint={dict.codeHint}
          required
          defaultValue={values?.code}
          error={e('code')}
          maxLength={32}
        />
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
          name="trn"
          label={dict.trnLabel}
          hint={dict.trnHint}
          defaultValue={values?.trn}
          error={e('trn')}
          inputMode="numeric"
          maxLength={11}
        />
        <TextField
          name="commercialRegNo"
          label={dict.commercialRegLabel}
          hint={dict.commercialRegHint}
          defaultValue={values?.commercialRegNo}
          error={e('commercialRegNo')}
        />
        <SelectField
          name="governorateCode"
          label={dict.governorateLabel}
          placeholder={dict.governoratePlaceholder}
          defaultValue={values?.governorateCode ?? ''}
          error={e('governorateCode')}
          options={GOVERNORATES.map((g) => ({ value: g.code, label: `${g.en} — ${g.ar}` }))}
        />
      </FieldGrid>

      <FieldGrid>
        <div className="gts-field-wide">
          <TextField
            name="addressLine"
            label={dict.addressLabel}
            defaultValue={values?.addressLine}
            error={e('addressLine')}
            autoComplete="street-address"
          />
        </div>
        <TextField
          name="contactName"
          label={dict.contactNameLabel}
          defaultValue={values?.contactName}
          error={e('contactName')}
        />
        <TextField
          name="contactPhone"
          label={dict.contactPhoneLabel}
          type="tel"
          defaultValue={values?.contactPhone}
          error={e('contactPhone')}
          placeholder="+20 10 1234 5678"
        />
        <TextField
          name="contactEmail"
          label={dict.contactEmailLabel}
          type="email"
          defaultValue={values?.contactEmail}
          error={e('contactEmail')}
        />
      </FieldGrid>

      <FieldGrid>
        <TextField
          name="paymentTermsDays"
          label={dict.paymentTermsLabel}
          hint={dict.paymentTermsHint}
          type="number"
          inputMode="numeric"
          defaultValue={values?.paymentTermsDays ?? 30}
          error={e('paymentTermsDays')}
        />
        <TextField
          name="creditLimit"
          label={dict.creditLimitLabel}
          hint={dict.creditLimitHint}
          type="number"
          inputMode="decimal"
          defaultValue={values?.creditLimit ?? '0'}
          error={e('creditLimit')}
        />
      </FieldGrid>

      <TextArea name="notes" label={dict.notesLabel} defaultValue={values?.notes} error={e('notes')} />

      <FormActions>
        <Submit variant="accent" pendingLabel={mode === 'create' ? dict.creating : dict.saving}>
          {mode === 'create' ? dict.createClient : dict.saveChanges}
        </Submit>
        <a
          href={mode === 'edit' && values?.id ? `/clients/${values.id}` : '/clients'}
          className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center gap-2"
        >
          {dict.cancel}
        </a>
      </FormActions>
    </form>
    </div>
  );
}
