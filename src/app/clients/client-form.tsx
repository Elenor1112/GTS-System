'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FormActions, FieldGrid, TextField, SelectField, TextArea, Submit, errorFor,
} from '@/components/form';
import { GOVERNORATES } from '@/lib/egypt';

import { submitCreateClient, submitUpdateClient } from './actions';

/**
 * The client form, used for both create and edit.
 *
 * One component rather than two near-identical ones: the only real
 * difference is which action it posts to and whether the fields start
 * populated, and duplicating 120 lines of markup to express that would
 * guarantee the two drift apart.
 */

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
}: {
  mode: 'create' | 'edit';
  values?: ClientFormValues;
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
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      {mode === 'edit' && values?.id && <input type="hidden" name="clientId" value={values.id} />}

      <FieldGrid>
        <TextField
          name="code"
          label="Client code"
          hint="Your own reference, e.g. CL-006"
          required
          defaultValue={values?.code}
          error={e('code')}
          maxLength={32}
        />
        <TextField
          name="nameEn"
          label="Name (English)"
          required
          defaultValue={values?.nameEn}
          error={e('nameEn')}
          maxLength={200}
        />
        <TextField
          name="nameAr"
          label="Name (Arabic)"
          defaultValue={values?.nameAr}
          error={e('nameAr')}
          maxLength={200}
        />
        <TextField
          name="trn"
          label="Tax registration number"
          hint="9 digits, issued by the Egyptian Tax Authority"
          defaultValue={values?.trn}
          error={e('trn')}
          inputMode="numeric"
          maxLength={11}
        />
        <TextField
          name="commercialRegNo"
          label="Commercial register"
          hint="Issued by GAFI"
          defaultValue={values?.commercialRegNo}
          error={e('commercialRegNo')}
        />
        <SelectField
          name="governorateCode"
          label="Governorate"
          placeholder="Select a governorate"
          defaultValue={values?.governorateCode ?? ''}
          error={e('governorateCode')}
          options={GOVERNORATES.map((g) => ({ value: g.code, label: `${g.en} — ${g.ar}` }))}
        />
      </FieldGrid>

      <FieldGrid>
        <div className="gts-field-wide">
          <TextField
            name="addressLine"
            label="Address"
            defaultValue={values?.addressLine}
            error={e('addressLine')}
            autoComplete="street-address"
          />
        </div>
        <TextField
          name="contactName"
          label="Contact name"
          defaultValue={values?.contactName}
          error={e('contactName')}
        />
        <TextField
          name="contactPhone"
          label="Contact phone"
          type="tel"
          defaultValue={values?.contactPhone}
          error={e('contactPhone')}
          placeholder="+20 10 1234 5678"
        />
        <TextField
          name="contactEmail"
          label="Contact email"
          type="email"
          defaultValue={values?.contactEmail}
          error={e('contactEmail')}
        />
      </FieldGrid>

      <FieldGrid>
        <TextField
          name="paymentTermsDays"
          label="Payment terms (days)"
          hint="Applied to the due date when a bill is raised"
          type="number"
          inputMode="numeric"
          defaultValue={values?.paymentTermsDays ?? 30}
          error={e('paymentTermsDays')}
        />
        <TextField
          name="creditLimit"
          label="Credit limit (EGP)"
          hint="0 means no limit"
          type="number"
          inputMode="decimal"
          defaultValue={values?.creditLimit ?? '0'}
          error={e('creditLimit')}
        />
      </FieldGrid>

      <TextArea name="notes" label="Notes" defaultValue={values?.notes} error={e('notes')} />

      <FormActions>
        <Submit variant="accent" pendingLabel={mode === 'create' ? 'Creating…' : 'Saving…'}>
          {mode === 'create' ? 'Create client' : 'Save changes'}
        </Submit>
        <a
          href={mode === 'edit' && values?.id ? `/clients/${values.id}` : '/clients'}
          className="gts-btn gts-btn-secondary"
        >
          Cancel
        </a>
      </FormActions>
    </form>
  );
}
