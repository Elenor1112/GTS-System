'use client';

import { useActionState } from 'react';

import {
  FormError, FormActions, FieldGrid, TextField, SelectField, Submit, errorFor,
} from '@/components/form';
import type { Dictionary } from '@/lib/i18n';

import { submitSettings } from './actions';

/**
 * Organisation settings.
 *
 * Grouped by what they affect rather than by where they are stored: the
 * tax identity appears on every invoice, the attendance values decide
 * what a check-in is allowed to be. Each group says what changing it
 * does, because "late threshold: 15" tells somebody nothing about
 * whether raising it forgives lateness or creates it.
 */
export function SettingsForm({
  values,
  governorates,
  dict,
}: {
  values: Record<string, string | number>;
  governorates: { value: number; label: string }[];
  dict: Dictionary['admin']['settings'];
}) {
  const [state, formAction] = useActionState(submitSettings, null);
  const e = (field: string) => errorFor(state, field);

  return (
    <form action={formAction} className="gts-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          {dict.savedNotice}
        </p>
      )}

      {/* ---------- Tax identity ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">{dict.taxIdentity.legend}</legend>
        <p className="gts-help">
          {dict.taxIdentity.help}
        </p>

        <FieldGrid>
          <TextField
            name="org.nameEn"
            label={dict.taxIdentity.orgNameLabel}
            required
            defaultValue={values['org.nameEn']}
            error={e('org.nameEn')}
          />
          <TextField
            name="org.nameAr"
            label={dict.taxIdentity.orgNameArLabel}
            defaultValue={values['org.nameAr']}
            error={e('org.nameAr')}
          />
          <TextField
            name="org.trn"
            label={dict.taxIdentity.trnLabel}
            hint={dict.taxIdentity.trnHint}
            inputMode="numeric"
            defaultValue={values['org.trn']}
            error={e('org.trn')}
          />
          <TextField
            name="org.commercialRegNo"
            label={dict.taxIdentity.commercialRegLabel}
            hint={dict.taxIdentity.commercialRegHint}
            defaultValue={values['org.commercialRegNo']}
            error={e('org.commercialRegNo')}
          />
          <SelectField
            name="org.governorateCode"
            label={dict.taxIdentity.governorateLabel}
            defaultValue={values['org.governorateCode']}
            error={e('org.governorateCode')}
            options={governorates}
          />
          <div className="gts-field-wide">
            <TextField
              name="org.addressLine"
              label={dict.taxIdentity.addressLabel}
              defaultValue={values['org.addressLine']}
              error={e('org.addressLine')}
            />
          </div>
        </FieldGrid>
      </fieldset>

      {/* ---------- Attendance ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">{dict.attendance.legend}</legend>
        <p className="gts-help">
          {dict.attendance.help}
        </p>

        <FieldGrid>
          <TextField
            name="attendance.workStart"
            label={dict.attendance.workStartLabel}
            hint={dict.attendance.workStartHint}
            defaultValue={values['attendance.workStart']}
            error={e('attendance.workStart')}
            placeholder="08:00"
          />
          <TextField
            name="attendance.workEnd"
            label={dict.attendance.workEndLabel}
            defaultValue={values['attendance.workEnd']}
            error={e('attendance.workEnd')}
            placeholder="17:00"
          />
          <TextField
            name="attendance.lateThresholdMinutes"
            label={dict.attendance.lateThresholdLabel}
            hint={dict.attendance.lateThresholdHint}
            type="number"
            inputMode="numeric"
            defaultValue={values['attendance.lateThresholdMinutes']}
            error={e('attendance.lateThresholdMinutes')}
          />
          <TextField
            name="attendance.defaultRadiusMetres"
            label={dict.attendance.defaultRadiusLabel}
            hint={dict.attendance.defaultRadiusHint}
            type="number"
            inputMode="numeric"
            defaultValue={values['attendance.defaultRadiusMetres']}
            error={e('attendance.defaultRadiusMetres')}
          />
          <TextField
            name="attendance.maxAccuracyMetres"
            label={dict.attendance.maxAccuracyLabel}
            hint={dict.attendance.maxAccuracyHint}
            type="number"
            inputMode="numeric"
            defaultValue={values['attendance.maxAccuracyMetres']}
            error={e('attendance.maxAccuracyMetres')}
          />
        </FieldGrid>
      </fieldset>

      {/* ---------- Billing ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">{dict.billing.legend}</legend>
        <p className="gts-help">
          {dict.billing.help}
        </p>

        <FieldGrid>
          <TextField
            name="bills.defaultPaymentTermsDays"
            label={dict.billing.paymentTermsLabel}
            type="number"
            inputMode="numeric"
            defaultValue={values['bills.defaultPaymentTermsDays']}
            error={e('bills.defaultPaymentTermsDays')}
          />
        </FieldGrid>
      </fieldset>

      <FormActions>
        <Submit variant="accent" pendingLabel={dict.savingButton}>
          {dict.saveButton}
        </Submit>
      </FormActions>
    </form>
  );
}
