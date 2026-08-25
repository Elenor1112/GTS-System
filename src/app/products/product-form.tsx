'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FieldGrid, TextField, SelectField, Submit, FormActions, errorFor,
} from '@/components/form';
import type { CatalogueDict } from '@/lib/i18n/dict/catalogue';

import { submitCreateProduct, submitUpdateProduct } from './actions';

type ProductFormDict = CatalogueDict['catalogue']['products']['form'];

/**
 * The product form, used for both create and edit.
 *
 * Money and quantity fields are plain text inputs with a decimal
 * inputMode rather than type="number": a spinner on a price is a way to
 * change a cost by scrolling past it, and the numeric keypad is what
 * actually matters on a phone in a warehouse.
 */

export interface ProductFormValues {
  id?: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  categoryId: string | null;
  vendorId: string | null;
  brand: string | null;
  unit: string;
  gpcCode: string | null;
  costPrice: string;
  salePrice: string;
  vatRate: string;
  reorderLevel: string;
}

export function ProductForm({
  mode,
  values,
  categories,
  vendors,
  warehouses,
  dict,
}: {
  mode: 'create' | 'edit';
  values?: ProductFormValues;
  categories: { id: string; nameEn: string }[];
  vendors: { id: string; nameEn: string; code: string }[];
  warehouses?: { id: string; nameEn: string; code: string }[];
  dict: ProductFormDict;
}) {
  const submit = mode === 'create' ? submitCreateProduct : submitUpdateProduct;
  const [state, formAction] = useActionState(submit, null);

  useEffect(() => {
    if (!state?.ok) return;
    const newId = 'id' in state.data ? (state.data.id as string) : values?.id;
    // A full navigation, not router.push(): the destination reads the row
    // that was just written, and the client router cache predates it.
    window.location.assign(newId ? `/products/${newId}` : '/products');
  }, [state, values?.id]);

  const e = (field: string) => errorFor(state, field);

  return (
    <form action={formAction} className="gts-form" noValidate>
      <FormError state={state} />

      {mode === 'edit' && values?.id && <input type="hidden" name="productId" value={values.id} />}

      <FieldGrid>
        <TextField
          name="sku"
          label={dict.skuLabel}
          hint={dict.skuHint}
          required
          defaultValue={values?.sku}
          error={e('sku')}
          maxLength={64}
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
          name="unit"
          label={dict.unitLabel}
          hint={dict.unitHint}
          required
          defaultValue={values?.unit}
          error={e('unit')}
          maxLength={24}
        />
        <SelectField
          name="categoryId"
          label={dict.categoryLabel}
          defaultValue={values?.categoryId ?? ''}
          error={e('categoryId')}
          options={[
            { value: '', label: dict.uncategorised },
            ...categories.map((c) => ({ value: c.id, label: c.nameEn })),
          ]}
        />
        <SelectField
          name="vendorId"
          label={dict.vendorLabel}
          defaultValue={values?.vendorId ?? ''}
          error={e('vendorId')}
          options={[
            { value: '', label: dict.noneOption },
            ...vendors.map((v) => ({ value: v.id, label: `${v.code} — ${v.nameEn}` })),
          ]}
        />
        <TextField
          name="brand"
          label={dict.brandLabel}
          defaultValue={values?.brand}
          error={e('brand')}
          maxLength={120}
        />
        <TextField
          name="gpcCode"
          label={dict.gpcCodeLabel}
          hint={dict.gpcCodeHint}
          defaultValue={values?.gpcCode}
          error={e('gpcCode')}
          maxLength={64}
        />
        <TextField
          name="costPrice"
          label={dict.costPriceLabel}
          hint={dict.costPriceHint}
          inputMode="decimal"
          defaultValue={values?.costPrice}
          error={e('costPrice')}
        />
        <TextField
          name="salePrice"
          label={dict.salePriceLabel}
          hint={dict.salePriceHint}
          inputMode="decimal"
          defaultValue={values?.salePrice}
          error={e('salePrice')}
        />
        <TextField
          name="vatRate"
          label={dict.vatRateLabel}
          hint={dict.vatRateHint}
          inputMode="decimal"
          defaultValue={values?.vatRate}
          error={e('vatRate')}
        />
        <TextField
          name="reorderLevel"
          label={dict.reorderLevelLabel}
          hint={dict.reorderLevelHint}
          inputMode="decimal"
          defaultValue={values?.reorderLevel}
          error={e('reorderLevel')}
        />

        {mode === 'create' && (
          <>
            <SelectField
              name="warehouseId"
              label={dict.warehouseLabel}
              hint={dict.warehouseHint}
              required
              placeholder={dict.warehousePlaceholder}
              error={e('warehouseId')}
              options={(warehouses ?? []).map((w) => ({ value: w.id, label: `${w.code} — ${w.nameEn}` }))}
            />
            <TextField
              name="openingQuantity"
              label={dict.openingQuantityLabel}
              hint={dict.openingQuantityHint}
              inputMode="decimal"
              error={e('openingQuantity')}
            />
            <TextField
              name="binLocation"
              label={dict.binLocationLabel}
              hint={dict.binLocationHint}
              error={e('binLocation')}
              maxLength={64}
            />
          </>
        )}
      </FieldGrid>

      <FormActions>
        <Submit variant="accent">{mode === 'create' ? dict.createProduct : dict.saveChanges}</Submit>
        <a
          href={values?.id ? `/products/${values.id}` : '/products'}
          className="h-touch px-4 rounded-sm border border-line bg-surface text-sm font-medium text-fg hover:bg-hover transition-colors inline-flex items-center"
        >
          {dict.cancel}
        </a>
      </FormActions>
    </form>
  );
}
