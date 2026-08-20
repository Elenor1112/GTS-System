'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FieldGrid, TextField, SelectField, TextArea, Submit, FormActions, errorFor,
} from '@/components/form';

import { submitCreateProject, submitUpdateProject } from './actions';

/**
 * The project form, used for both create and edit.
 *
 * The site location is deliberately NOT here. It carries its own
 * permission (`projects.location`) because a geofence is what attendance
 * is checked against — moving it silently changes who counts as on site.
 * It is set from the project page, by someone allowed to set it.
 */

const STATUSES = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export interface ProjectFormValues {
  id?: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  clientId: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  budget: string | null;
  notes: string | null;
}

export function ProjectForm({
  mode,
  values,
  clients,
}: {
  mode: 'create' | 'edit';
  values?: ProjectFormValues;
  clients: { id: string; code: string; nameEn: string }[];
}) {
  const submit = mode === 'create' ? submitCreateProject : submitUpdateProject;
  const [state, formAction] = useActionState(submit, null);

  useEffect(() => {
    if (!state?.ok) return;
    const newId = 'id' in state.data ? (state.data.id as string) : values?.id;
    window.location.assign(newId ? `/projects/${newId}` : '/projects');
  }, [state, values?.id]);

  const e = (field: string) => errorFor(state, field);

  return (
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      {mode === 'edit' && values?.id && <input type="hidden" name="projectId" value={values.id} />}

      <FieldGrid>
        <TextField
          name="code"
          label="Project code"
          hint="Your own reference, e.g. PRJ-2026-014"
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
        <SelectField
          name="clientId"
          label="Client"
          required
          defaultValue={values?.clientId ?? ''}
          error={e('clientId')}
          placeholder="Choose a client"
          options={clients.map((c) => ({ value: c.id, label: `${c.code} — ${c.nameEn}` }))}
        />
        <SelectField
          name="status"
          label="Status"
          defaultValue={values?.status ?? 'PLANNING'}
          error={e('status')}
          options={STATUSES}
        />
        <TextField
          name="budget"
          label="Budget (EGP)"
          hint="Optional. Leave blank if not yet agreed."
          inputMode="decimal"
          defaultValue={values?.budget}
          error={e('budget')}
        />
        <TextField
          name="startsOn"
          label="Starts on"
          type="date"
          defaultValue={values?.startsOn}
          error={e('startsOn')}
        />
        <TextField
          name="endsOn"
          label="Ends on"
          type="date"
          defaultValue={values?.endsOn}
          error={e('endsOn')}
        />
      </FieldGrid>

      <TextArea name="notes" label="Notes" defaultValue={values?.notes} error={e('notes')} />

      <FormActions>
        <a
          className="gts-btn gts-btn-ghost"
          href={values?.id ? `/projects/${values.id}` : '/projects'}
        >
          Cancel
        </a>
        <Submit>{mode === 'create' ? 'Create project' : 'Save changes'}</Submit>
      </FormActions>
    </form>
  );
}
