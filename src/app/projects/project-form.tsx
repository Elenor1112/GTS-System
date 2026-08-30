'use client';

import dynamic from 'next/dynamic';
import { useActionState, useEffect, useState } from 'react';

import {
  FormError, FieldGrid, TextField, SelectField, TextArea, Submit, FormActions, errorFor,
} from '@/components/form';
import { Icon } from '@/components/icon';
import { GOVERNORATES } from '@/lib/egypt';
import { DEFAULT_RADIUS } from '@/lib/geofence';
import type { OperationsDict } from '@/lib/i18n/dict/operations';

import { submitCreateProject, submitUpdateProject } from './actions';
import type { StockOption } from './[id]/materials-form';

// Leaflet reaches for `window` at module load, so it cannot be part of
// the server-rendered bundle — loaded client-side only, after mount.
const LocationMapPicker = dynamic(
  () => import('./location-map-picker').then((m) => m.LocationMapPicker),
  { ssr: false, loading: () => <div className="gts-map-picker-loading" /> },
);

/**
 * The project form, used for both create and edit.
 *
 * On create, three optional sections follow the base fields — site
 * location, an initial team member, an initial material allocation —
 * each shown only to someone holding its own permission
 * (`projects.location` / `projects.assign` / `inventory.manage`). They
 * are collapsed behind a checkbox because most projects do not have any
 * of this decided on day one, and an empty required-looking section
 * would be confusing on a form that is otherwise all optional past the
 * name and client.
 *
 * On edit, none of this applies — location, the team and materials are
 * managed from the project page, against an id that already exists.
 */

export type ProjectFormDict = OperationsDict['operations']['projects']['form'];
type LocationDict = OperationsDict['operations']['projects']['location'];
type AssignDict = OperationsDict['operations']['projects']['assign'];
type MaterialsDict = OperationsDict['operations']['projects']['materials'];

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
  canSetLocation = false,
  locationDict,
  canAssign = false,
  employees = [],
  assignDict,
  canMoveStock = false,
  products = [],
  materialsDict,
}: {
  mode: 'create' | 'edit';
  values?: ProjectFormValues;
  clients: { id: string; code: string; nameEn: string }[];
  dict: ProjectFormDict;
  canSetLocation?: boolean;
  locationDict?: LocationDict;
  canAssign?: boolean;
  employees?: { id: string; code: string; nameEn: string; jobTitleEn: string }[];
  assignDict?: AssignDict;
  canMoveStock?: boolean;
  products?: StockOption[];
  materialsDict?: MaterialsDict;
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

  const showLocation = mode === 'create' && canSetLocation && locationDict;
  const showAssign = mode === 'create' && canAssign && assignDict;
  const showMaterials = mode === 'create' && canMoveStock && materialsDict && products.length > 0;

  const [setLocation, setSetLocation] = useState(false);
  const [assignNow, setAssignNow] = useState(false);
  const [allocateNow, setAllocateNow] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [governorateCode, setGovernorateCode] = useState<number | undefined>(undefined);
  const [assignEmployeeIds, setAssignEmployeeIds] = useState<string[]>([]);
  const [materialProductId, setMaterialProductId] = useState('');

  const selectedProduct = products.find((p) => p.id === materialProductId) ?? null;

  const useMyPosition = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  return (
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      {mode === 'edit' && values?.id && <input type="hidden" name="projectId" value={values.id} />}

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

      {showLocation && (
        <section className="gts-form-section">
          <label className="gts-checkbox-label">
            <input
              type="checkbox"
              checked={setLocation}
              onChange={(event) => setSetLocation(event.target.checked)}
            />{' '}
            {locationDict.setSiteLocation}
          </label>

          {setLocation && (
            <div className="mt-4">
              <FieldGrid>
                <div className="gts-field-wide">
                  <TextField
                    name="location.addressLine"
                    label={locationDict.addressLabel}
                    required
                    error={e('location.addressLine')}
                    placeholder={locationDict.addressPlaceholder}
                  />
                </div>

                <div className="gts-field">
                  <label className="gts-label" htmlFor="location.governorateCode">
                    {locationDict.governorateLabel} <span className="gts-required">*</span>
                  </label>
                  <select
                    id="location.governorateCode"
                    name="location.governorateCode"
                    required
                    className="gts-input gts-select"
                    value={governorateCode ?? ''}
                    onChange={(event) =>
                      setGovernorateCode(event.target.value ? Number(event.target.value) : undefined)
                    }
                    aria-invalid={e('location.governorateCode') ? true : undefined}
                  >
                    <option value="">{locationDict.governoratePlaceholder}</option>
                    {GOVERNORATES.map((g) => (
                      <option key={g.code} value={g.code}>
                        {g.en} — {g.ar}
                      </option>
                    ))}
                  </select>
                  {e('location.governorateCode') && (
                    <p className="gts-help gts-help-error">{e('location.governorateCode')}</p>
                  )}
                </div>

                <SelectField
                  name="location.siteType"
                  label={locationDict.siteTypeLabel}
                  hint={locationDict.siteTypeHint}
                  defaultValue="site"
                  error={e('location.siteType')}
                  options={[
                    { value: 'office', label: `${locationDict.siteTypeOffice} — ${DEFAULT_RADIUS.office}m` },
                    { value: 'warehouse', label: `${locationDict.siteTypeWarehouse} — ${DEFAULT_RADIUS.warehouse}m` },
                    { value: 'site', label: `${locationDict.siteTypeSite} — ${DEFAULT_RADIUS.site}m` },
                    { value: 'yard', label: `${locationDict.siteTypeYard} — ${DEFAULT_RADIUS.yard}m` },
                  ]}
                />
              </FieldGrid>

              <LocationMapPicker
                lat={lat}
                lng={lng}
                governorateCode={governorateCode}
                onPick={(pickedLat, pickedLng) => {
                  setLat(pickedLat);
                  setLng(pickedLng);
                }}
              />

              <FieldGrid>
                <div className="gts-field">
                  <label className="gts-label" htmlFor="location.latitude">
                    {locationDict.latitudeLabel} <span className="gts-required">*</span>
                  </label>
                  <input
                    id="location.latitude"
                    name="location.latitude"
                    required
                    className="gts-input gts-input-num"
                    value={lat}
                    onChange={(event) => setLat(event.target.value)}
                    inputMode="decimal"
                    placeholder="30.013100"
                    aria-invalid={e('location.latitude') ? true : undefined}
                  />
                  {e('location.latitude') && <p className="gts-help gts-help-error">{e('location.latitude')}</p>}
                </div>

                <div className="gts-field">
                  <label className="gts-label" htmlFor="location.longitude">
                    {locationDict.longitudeLabel} <span className="gts-required">*</span>
                  </label>
                  <input
                    id="location.longitude"
                    name="location.longitude"
                    required
                    className="gts-input gts-input-num"
                    value={lng}
                    onChange={(event) => setLng(event.target.value)}
                    inputMode="decimal"
                    placeholder="31.491400"
                    aria-invalid={e('location.longitude') ? true : undefined}
                  />
                  {e('location.longitude') && <p className="gts-help gts-help-error">{e('location.longitude')}</p>}
                </div>

                <TextField
                  name="location.radiusMetres"
                  label={locationDict.radiusLabel}
                  hint={locationDict.radiusHint}
                  required
                  type="number"
                  inputMode="numeric"
                  defaultValue={DEFAULT_RADIUS.site}
                  error={e('location.radiusMetres')}
                />
              </FieldGrid>

              <div className="gts-location-tools">
                <button
                  type="button"
                  className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center gap-2"
                  onClick={useMyPosition}
                >
                  <Icon name="my_location" size={18} />
                  {locating ? locationDict.findingYou : locationDict.useMyPosition}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {showAssign && (
        <section className="gts-form-section">
          <label className="gts-checkbox-label">
            <input
              type="checkbox"
              checked={assignNow}
              onChange={(event) => setAssignNow(event.target.checked)}
            />{' '}
            {assignDict.assign}
          </label>

          {assignNow && (
            <>
              <div className="gts-field">
                <label className="gts-label">{assignDict.employeeLabel}</label>
                <div className="gts-checkbox-list" role="group" aria-label={assignDict.employeeLabel}>
                  {employees.map((emp) => (
                    <label key={emp.id} className="gts-checkbox-list-item">
                      <input
                        type="checkbox"
                        name="assignEmployeeIds"
                        value={emp.id}
                        checked={assignEmployeeIds.includes(emp.id)}
                        onChange={(event) => {
                          setAssignEmployeeIds((current) =>
                            event.target.checked
                              ? [...current, emp.id]
                              : current.filter((id) => id !== emp.id),
                          );
                        }}
                      />
                      {emp.nameEn} — {emp.jobTitleEn}
                    </label>
                  ))}
                </div>
                {e('assignEmployeeIds') && (
                  <p className="gts-help gts-help-error">{e('assignEmployeeIds')}</p>
                )}
              </div>
              <FieldGrid>
                <TextField
                  name="roleOnSite"
                  label={assignDict.roleOnSiteLabel}
                  hint={assignDict.roleOnSiteHint}
                  placeholder={assignDict.roleOnSitePlaceholder}
                  error={e('roleOnSite')}
                />
              </FieldGrid>
            </>
          )}
        </section>
      )}

      {showMaterials && (
        <section className="gts-form-section">
          <label className="gts-checkbox-label">
            <input
              type="checkbox"
              checked={allocateNow}
              onChange={(event) => setAllocateNow(event.target.checked)}
            />{' '}
            {materialsDict.allocate}
          </label>

          {allocateNow && (
            <FieldGrid>
              <div className="gts-field">
                <label className="gts-label" htmlFor="material.productId">
                  {materialsDict.productLabel}
                </label>
                <select
                  id="material.productId"
                  name="material.productId"
                  className="gts-input gts-select"
                  value={materialProductId}
                  onChange={(event) => setMaterialProductId(event.target.value)}
                  aria-invalid={e('material.productId') ? true : undefined}
                >
                  <option value="">{materialsDict.productPlaceholder}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn} — {p.sku}
                    </option>
                  ))}
                </select>
                {e('material.productId') && (
                  <p className="gts-help gts-help-error">{e('material.productId')}</p>
                )}
              </div>
              <SelectField
                name="material.warehouseId"
                label={materialsDict.fromWarehouseLabel}
                placeholder={selectedProduct ? materialsDict.selectWarehouse : materialsDict.chooseProductFirst}
                error={e('material.warehouseId')}
                options={(selectedProduct?.warehouses ?? []).map((w) => ({
                  value: w.id,
                  label: `${w.nameEn} — ${w.available} ${selectedProduct?.unit} ${materialsDict.freeSuffix}`,
                }))}
              />
              <TextField
                name="material.quantity"
                label={`${materialsDict.quantityLabel}${selectedProduct ? ` (${selectedProduct.unit})` : ''}`}
                inputMode="decimal"
                error={e('material.quantity')}
              />
              <TextField
                name="material.agreedPrice"
                label={materialsDict.agreedPriceLabel}
                hint={materialsDict.agreedPricePlaceholder}
                inputMode="decimal"
                error={e('material.agreedPrice')}
              />
            </FieldGrid>
          )}
        </section>
      )}

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
