'use client';

import { useActionState, useState } from 'react';

import {
  FormError, FormActions, FieldGrid, TextField, SelectField, Submit, errorFor,
} from '@/components/form';
import { GOVERNORATES } from '@/lib/egypt';
import { DEFAULT_RADIUS, mapUrl } from '@/lib/geofence';
import type { OperationsDict } from '@/lib/i18n/dict/operations';

import { submitProjectLocation } from '../actions';

export type LocationFormDict = OperationsDict['operations']['projects']['location'];

/**
 * The site location and its geofence.
 *
 * Deliberately its own form with its own permission. This is the record
 * attendance is judged against: an employee who could set it could check
 * in from home. Only somebody holding `projects.location` reaches this.
 *
 * The "use my current position" button is a convenience for an
 * administrator standing on the site. It fills the fields; it does not
 * submit, so the value is always something a person looked at and chose.
 */
export function LocationForm({
  projectId,
  existing,
  dict,
}: {
  projectId: string;
  existing: {
    addressLine: string;
    governorateCode: number;
    latitude: string;
    longitude: string;
    radiusMetres: number;
    siteType: string;
  } | null;
  dict: LocationFormDict;
}) {
  const [state, formAction] = useActionState(submitProjectLocation, null);
  const [lat, setLat] = useState(existing?.latitude ?? '');
  const [lng, setLng] = useState(existing?.longitude ?? '');
  const [locating, setLocating] = useState(false);

  const e = (field: string) => errorFor(state, field);

  const useMyPosition = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Six decimal places is roughly 0.1m — more than a site fence
        // needs, and what the Decimal(9,6) column stores.
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  return (
    <form action={formAction} className="gts-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          {dict.successMessage}
        </p>
      )}

      <input type="hidden" name="projectId" value={projectId} />

      <FieldGrid>
        <div className="gts-field-wide">
          <TextField
            name="addressLine"
            label={dict.addressLabel}
            required
            defaultValue={existing?.addressLine}
            error={e('addressLine')}
            placeholder={dict.addressPlaceholder}
          />
        </div>

        <SelectField
          name="governorateCode"
          label={dict.governorateLabel}
          required
          placeholder={dict.governoratePlaceholder}
          defaultValue={existing?.governorateCode ?? ''}
          error={e('governorateCode')}
          options={GOVERNORATES.map((g) => ({ value: g.code, label: `${g.en} — ${g.ar}` }))}
        />

        <SelectField
          name="siteType"
          label={dict.siteTypeLabel}
          hint={dict.siteTypeHint}
          defaultValue={existing?.siteType ?? 'site'}
          error={e('siteType')}
          options={[
            { value: 'office', label: `${dict.siteTypeOffice} — ${DEFAULT_RADIUS.office}m` },
            { value: 'warehouse', label: `${dict.siteTypeWarehouse} — ${DEFAULT_RADIUS.warehouse}m` },
            { value: 'site', label: `${dict.siteTypeSite} — ${DEFAULT_RADIUS.site}m` },
            { value: 'yard', label: `${dict.siteTypeYard} — ${DEFAULT_RADIUS.yard}m` },
          ]}
        />
      </FieldGrid>

      <FieldGrid>
        <div className="gts-field">
          <label className="gts-label" htmlFor="latitude">
            {dict.latitudeLabel} <span className="gts-required">*</span>
          </label>
          <input
            id="latitude"
            name="latitude"
            required
            className="gts-input gts-input-num"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            inputMode="decimal"
            placeholder="30.013100"
            aria-invalid={e('latitude') ? true : undefined}
          />
          {e('latitude') && <p className="gts-help gts-help-error">{e('latitude')}</p>}
        </div>

        <div className="gts-field">
          <label className="gts-label" htmlFor="longitude">
            {dict.longitudeLabel} <span className="gts-required">*</span>
          </label>
          <input
            id="longitude"
            name="longitude"
            required
            className="gts-input gts-input-num"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            inputMode="decimal"
            placeholder="31.491400"
            aria-invalid={e('longitude') ? true : undefined}
          />
          {e('longitude') && <p className="gts-help gts-help-error">{e('longitude')}</p>}
        </div>

        <TextField
          name="radiusMetres"
          label={dict.radiusLabel}
          hint={dict.radiusHint}
          required
          type="number"
          inputMode="numeric"
          defaultValue={existing?.radiusMetres ?? DEFAULT_RADIUS.site}
          error={e('radiusMetres')}
        />
      </FieldGrid>

      <div className="gts-location-tools">
        <button type="button" className="gts-btn gts-btn-secondary" onClick={useMyPosition}>
          {locating ? dict.findingYou : dict.useMyPosition}
        </button>
        {lat && lng && (
          <a
            href={mapUrl({ lat: Number(lat), lng: Number(lng) })}
            target="_blank"
            rel="noreferrer"
            className="gts-btn gts-btn-ghost"
          >
            {dict.checkPinOnMap}
          </a>
        )}
      </div>

      <FormActions>
        <Submit variant="accent" pendingLabel={dict.saving}>
          {existing ? dict.moveSiteBoundary : dict.setSiteLocation}
        </Submit>
      </FormActions>
    </form>
  );
}
