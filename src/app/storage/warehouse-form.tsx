'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FieldGrid, TextField, SelectField, Submit, FormActions, errorFor,
} from '@/components/form';
import { GOVERNORATES } from '@/lib/egypt';
import type { CatalogueDict } from '@/lib/i18n/dict/catalogue';

import { submitCreateWarehouse, submitUpdateWarehouse } from './actions';

type WarehouseFormDict = CatalogueDict['catalogue']['warehouses']['form'];

/**
 * The warehouse form, used for both create and edit.
 *
 * One component rather than two near-identical ones, for the same reason
 * the vendor form is one: the only real difference is which action it
 * posts to and whether the fields start populated.
 */

export interface WarehouseFormValues {
  id?: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  governorateCode: number | null;
  addressLine: string | null;
  latitude: string | null;
  longitude: string | null;
  capacityM3: string | null;
}

export function WarehouseForm({
  mode,
  values,
  dict,
}: {
  mode: 'create' | 'edit';
  values?: WarehouseFormValues;
  dict: WarehouseFormDict;
}) {
  const submit = mode === 'create' ? submitCreateWarehouse : submitUpdateWarehouse;
  const [state, formAction] = useActionState(submit, null);

  useEffect(() => {
    if (!state?.ok) return;

    const newId = 'id' in state.data ? (state.data.id as string) : values?.id;
    const target = newId ? `/storage/${newId}` : '/storage';

    // A full navigation rather than router.push(), matching the vendor
    // form: the destination is a server component that must read the row
    // just written, and router.push() would serve it from a client cache
    // populated before the write.
    window.location.assign(target);
  }, [state, values?.id]);

  const e = (field: string) => errorFor(state, field);

  return (
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      {mode === 'edit' && values?.id && (
        <input type="hidden" name="warehouseId" value={values.id} />
      )}

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
          name="governorateCode"
          label={dict.governorateLabel}
          defaultValue={values?.governorateCode ?? ''}
          error={e('governorateCode')}
          options={[
            { value: '', label: dict.notRecorded },
            ...GOVERNORATES.map((g) => ({ value: String(g.code), label: g.en })),
          ]}
        />
        <TextField
          name="addressLine"
          label={dict.addressLabel}
          defaultValue={values?.addressLine}
          error={e('addressLine')}
          maxLength={300}
        />
        <TextField
          name="capacityM3"
          label={dict.capacityLabel}
          hint={dict.capacityHint}
          type="number"
          inputMode="decimal"
          defaultValue={values?.capacityM3}
          error={e('capacityM3')}
        />
        <TextField
          name="latitude"
          label={dict.latitudeLabel}
          hint={dict.latitudeHint}
          type="number"
          inputMode="decimal"
          defaultValue={values?.latitude}
          error={e('latitude')}
        />
        <TextField
          name="longitude"
          label={dict.longitudeLabel}
          type="number"
          inputMode="decimal"
          defaultValue={values?.longitude}
          error={e('longitude')}
        />
      </FieldGrid>

      <FormActions>
        <a className="gts-btn gts-btn-ghost" href={values?.id ? `/storage/${values.id}` : '/storage'}>
          {dict.cancel}
        </a>
        <Submit>{mode === 'create' ? dict.createWarehouse : dict.saveChanges}</Submit>
      </FormActions>
    </form>
  );
}
