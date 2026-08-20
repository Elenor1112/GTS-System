'use client';

import { useActionState, useEffect } from 'react';

import {
  FormError, FieldGrid, TextField, SelectField, Submit, FormActions, errorFor,
} from '@/components/form';

import { submitCreateProduct, submitUpdateProduct } from './actions';

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
}: {
  mode: 'create' | 'edit';
  values?: ProductFormValues;
  categories: { id: string; nameEn: string }[];
  vendors: { id: string; nameEn: string; code: string }[];
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
          label="SKU"
          hint="Your own stock code, e.g. CBL-3C-25"
          required
          defaultValue={values?.sku}
          error={e('sku')}
          maxLength={64}
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
          name="unit"
          label="Unit"
          hint="How it is counted — each, m, kg, roll"
          required
          defaultValue={values?.unit}
          error={e('unit')}
          maxLength={24}
        />
        <SelectField
          name="categoryId"
          label="Category"
          defaultValue={values?.categoryId ?? ''}
          error={e('categoryId')}
          options={[
            { value: '', label: 'Uncategorised' },
            ...categories.map((c) => ({ value: c.id, label: c.nameEn })),
          ]}
        />
        <SelectField
          name="vendorId"
          label="Preferred vendor"
          defaultValue={values?.vendorId ?? ''}
          error={e('vendorId')}
          options={[
            { value: '', label: 'None' },
            ...vendors.map((v) => ({ value: v.id, label: `${v.code} — ${v.nameEn}` })),
          ]}
        />
        <TextField
          name="brand"
          label="Brand"
          defaultValue={values?.brand}
          error={e('brand')}
          maxLength={120}
        />
        <TextField
          name="gpcCode"
          label="GPC code"
          hint="Egyptian e-invoicing item code, if the item has one"
          defaultValue={values?.gpcCode}
          error={e('gpcCode')}
          maxLength={64}
        />
        <TextField
          name="costPrice"
          label="Cost price (EGP)"
          hint="What you pay. Drives stock valuation."
          inputMode="decimal"
          defaultValue={values?.costPrice}
          error={e('costPrice')}
        />
        <TextField
          name="salePrice"
          label="Sale price (EGP)"
          hint="What you charge. Used to price bill lines."
          inputMode="decimal"
          defaultValue={values?.salePrice}
          error={e('salePrice')}
        />
        <TextField
          name="vatRate"
          label="VAT rate (%)"
          hint="14 is the Egyptian standard rate. Zero-rated and exempt goods take 0."
          inputMode="decimal"
          defaultValue={values?.vatRate}
          error={e('vatRate')}
        />
        <TextField
          name="reorderLevel"
          label="Reorder level"
          hint="Stock at or below this raises the low-stock flag."
          inputMode="decimal"
          defaultValue={values?.reorderLevel}
          error={e('reorderLevel')}
        />
      </FieldGrid>

      <FormActions>
        <a
          className="gts-btn gts-btn-ghost"
          href={values?.id ? `/products/${values.id}` : '/products'}
        >
          Cancel
        </a>
        <Submit>{mode === 'create' ? 'Create product' : 'Save changes'}</Submit>
      </FormActions>
    </form>
  );
}
