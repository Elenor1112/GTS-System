'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FieldGrid, TextField, SelectField, TextArea, Submit, FormActions, errorFor,
} from '@/components/form';
import type { OperationsDict } from '@/lib/i18n/dict/operations';

import { submitCreateProject, submitUpdateProject } from './actions';

/**
 * The project form, used for both create and edit.
 *
 * The site location is deliberately NOT here. It carries its own
 * permission (`projects.location`) because a geofence is what attendance
 * is checked against — moving it silently changes who counts as on site.
 * It is set from the project page, by someone allowed to set it.
 */

export type ProjectFormDict = OperationsDict['operations']['projects']['form'];

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
  dict,
}: {
  mode: 'create' | 'edit';
  values?: ProjectFormValues;
  clients: { id: string; code: string; nameEn: string }[];
  dict: ProjectFormDict;
}) {
  const STATUSES = [
    { value: 'PLANNING', label: dict.statusPlanning },
    { value: 'ACTIVE', label: dict.statusActive },
    { value: 'ON_HOLD', label: dict.statusOnHold },
    { value: 'COMPLETED', label: dict.statusCompleted },
    { value: 'CANCELLED', label: dict.statusCancelled },
  ];

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
        <SelectField
          name="clientId"
          label={dict.clientLabel}
          required
          defaultValue={values?.clientId ?? ''}
          error={e('clientId')}
          placeholder={dict.clientPlaceholder}
          options={clients.map((c) => ({ value: c.id, label: `${c.code} — ${c.nameEn}` }))}
        />
        <SelectField
          name="status"
          label={dict.statusLabel}
          defaultValue={values?.status ?? 'PLANNING'}
          error={e('status')}
          options={STATUSES}
        />
        <TextField
          name="budget"
          label={dict.budgetLabel}
          hint={dict.budgetHint}
          inputMode="decimal"
          defaultValue={values?.budget}
          error={e('budget')}
        />
        <TextField
          name="startsOn"
          label={dict.startsOnLabel}
          type="date"
          defaultValue={values?.startsOn}
          error={e('startsOn')}
        />
        <TextField
          name="endsOn"
          label={dict.endsOnLabel}
          type="date"
          defaultValue={values?.endsOn}
          error={e('endsOn')}
        />
      </FieldGrid>

      <TextArea name="notes" label={dict.notesLabel} defaultValue={values?.notes} error={e('notes')} />

      <FormActions>
        <a
          className="gts-btn gts-btn-ghost"
          href={values?.id ? `/projects/${values.id}` : '/projects'}
        >
          {dict.cancel}
        </a>
        <Submit>{mode === 'create' ? dict.createProject : dict.saveChanges}</Submit>
      </FormActions>
    </form>
  );
}
