'use client';

import { useActionState } from 'react';

import {
  FormError, FormActions, FieldGrid, TextField, SelectField, Submit, errorFor,
} from '@/components/form';

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
}: {
  values: Record<string, string | number>;
  governorates: { value: number; label: string }[];
}) {
  const [state, formAction] = useActionState(submitSettings, null);
  const e = (field: string) => errorFor(state, field);

  return (
    <form action={formAction} className="gts-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          Saved. The new values apply to the next check-in and the next bill raised.
        </p>
      )}

      {/* ---------- Tax identity ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">Tax identity</legend>
        <p className="gts-help">
          Printed on every invoice as the issuer. An invoice without a valid 9-digit
          registration number is not a valid Egyptian tax document.
        </p>

        <FieldGrid>
          <TextField
            name="org.nameEn"
            label="Organisation name"
            required
            defaultValue={values['org.nameEn']}
            error={e('org.nameEn')}
          />
          <TextField
            name="org.nameAr"
            label="Organisation name (Arabic)"
            defaultValue={values['org.nameAr']}
            error={e('org.nameAr')}
          />
          <TextField
            name="org.trn"
            label="Tax registration number"
            hint="9 digits, issued by the Egyptian Tax Authority"
            inputMode="numeric"
            defaultValue={values['org.trn']}
            error={e('org.trn')}
          />
          <TextField
            name="org.commercialRegNo"
            label="Commercial register"
            hint="Issued by GAFI"
            defaultValue={values['org.commercialRegNo']}
            error={e('org.commercialRegNo')}
          />
          <SelectField
            name="org.governorateCode"
            label="Governorate"
            defaultValue={values['org.governorateCode']}
            error={e('org.governorateCode')}
            options={governorates}
          />
          <div className="gts-field-wide">
            <TextField
              name="org.addressLine"
              label="Address"
              defaultValue={values['org.addressLine']}
              error={e('org.addressLine')}
            />
          </div>
        </FieldGrid>
      </fieldset>

      {/* ---------- Attendance ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">Attendance</legend>
        <p className="gts-help">
          These decide what the server accepts. A check-in outside the radius, or from a fix
          coarser than the accuracy limit, is refused — raising these values widens what counts
          as being on site.
        </p>

        <FieldGrid>
          <TextField
            name="attendance.workStart"
            label="Working day starts"
            hint="24-hour, Cairo time"
            defaultValue={values['attendance.workStart']}
            error={e('attendance.workStart')}
            placeholder="08:00"
          />
          <TextField
            name="attendance.workEnd"
            label="Working day ends"
            defaultValue={values['attendance.workEnd']}
            error={e('attendance.workEnd')}
            placeholder="17:00"
          />
          <TextField
            name="attendance.lateThresholdMinutes"
            label="Late after (minutes)"
            hint="Grace period before a check-in is marked late"
            type="number"
            inputMode="numeric"
            defaultValue={values['attendance.lateThresholdMinutes']}
            error={e('attendance.lateThresholdMinutes')}
          />
          <TextField
            name="attendance.defaultRadiusMetres"
            label="Default site radius (metres)"
            hint="Suggested when a new project location is pinned"
            type="number"
            inputMode="numeric"
            defaultValue={values['attendance.defaultRadiusMetres']}
            error={e('attendance.defaultRadiusMetres')}
          />
          <TextField
            name="attendance.maxAccuracyMetres"
            label="Refuse a fix coarser than (metres)"
            hint="Below this, a position cannot tell inside a site from outside it"
            type="number"
            inputMode="numeric"
            defaultValue={values['attendance.maxAccuracyMetres']}
            error={e('attendance.maxAccuracyMetres')}
          />
        </FieldGrid>
      </fieldset>

      {/* ---------- Billing ---------- */}
      <fieldset className="gts-fieldset">
        <legend className="gts-overline">Billing</legend>
        <p className="gts-help">
          Applied when a counterparty has no terms of their own. VAT and the withholding
          threshold are statutory and are not set here.
        </p>

        <FieldGrid>
          <TextField
            name="bills.defaultPaymentTermsDays"
            label="Default payment terms (days)"
            type="number"
            inputMode="numeric"
            defaultValue={values['bills.defaultPaymentTermsDays']}
            error={e('bills.defaultPaymentTermsDays')}
          />
        </FieldGrid>
      </fieldset>

      <FormActions>
        <Submit variant="accent" pendingLabel="Saving…">
          Save settings
        </Submit>
      </FormActions>
    </form>
  );
}
