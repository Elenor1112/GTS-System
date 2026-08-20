'use client';

import { useActionState, useState } from 'react';

import { FormError, Submit, errorFor } from '@/components/form';

import {
  submitAllocateToProject,
  submitDeliverToProject,
  submitReturnFromProject,
} from '../actions';

export interface StockOption {
  id: string;
  sku: string;
  nameEn: string;
  unit: string;
  salePrice: string;
  /** Warehouses actually holding this product, with what is free to take. */
  warehouses: { id: string; code: string; nameEn: string; available: string }[];
}

/**
 * Allocate stock from a warehouse to this site.
 *
 * The product list is driven from warehouse stock rather than the
 * catalogue: offering a product with nothing on any shelf produces a
 * form whose only possible outcome is an INSUFFICIENT_STOCK error. The
 * warehouse select then narrows to the shelves that actually hold the
 * chosen product, and each option states what is free — so the quantity
 * is typed against a number the user can see rather than guessed.
 */
export function AllocateForm({
  projectId,
  products,
  closed,
}: {
  projectId: string;
  products: StockOption[];
  closed: boolean;
}) {
  const [state, formAction] = useActionState(submitAllocateToProject, null);
  const [productId, setProductId] = useState('');

  const selected = products.find((p) => p.id === productId) ?? null;

  if (closed) {
    return (
      <p className="gts-meta">
        This project is closed. Stock can no longer be allocated to it.
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="gts-meta">
        No warehouse is holding stock. Receive stock into a warehouse before
        allocating it to a site.
      </p>
    );
  }

  return (
    <form action={formAction} className="gts-assign-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          Allocated. The units have left the warehouse and are now against this
          project — record the delivery once they reach the site.
        </p>
      )}

      <input type="hidden" name="projectId" value={projectId} />

      <div className="gts-field" style={{ flex: '1 1 15rem' }}>
        <label className="gts-label" htmlFor="allocate-productId">
          Product
        </label>
        <select
          id="allocate-productId"
          name="productId"
          required
          className="gts-input gts-select"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          aria-invalid={errorFor(state, 'productId') ? true : undefined}
        >
          <option value="">Select a product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.nameEn} — {product.sku}
            </option>
          ))}
        </select>
      </div>

      <div className="gts-field" style={{ flex: '1 1 13rem' }}>
        <label className="gts-label" htmlFor="allocate-warehouseId">
          From warehouse
        </label>
        <select
          id="allocate-warehouseId"
          name="warehouseId"
          required
          className="gts-input gts-select"
          defaultValue=""
          disabled={!selected}
          aria-invalid={errorFor(state, 'warehouseId') ? true : undefined}
        >
          <option value="">
            {selected ? 'Select a warehouse' : 'Choose a product first'}
          </option>
          {selected?.warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.nameEn} — {warehouse.available} {selected.unit} free
            </option>
          ))}
        </select>
      </div>

      <div className="gts-field" style={{ flex: '0 1 8rem' }}>
        <label className="gts-label" htmlFor="allocate-quantity">
          Quantity{selected ? ` (${selected.unit})` : ''}
        </label>
        <input
          id="allocate-quantity"
          name="quantity"
          type="number"
          step="0.001"
          min="0"
          required
          className="gts-input gts-input-num"
          aria-invalid={errorFor(state, 'quantity') ? true : undefined}
        />
      </div>

      <div className="gts-field" style={{ flex: '0 1 9rem' }}>
        <label className="gts-label" htmlFor="allocate-agreedPrice">
          Agreed price
        </label>
        <input
          id="allocate-agreedPrice"
          name="agreedPrice"
          type="number"
          step="0.01"
          min="0"
          className="gts-input gts-input-num"
          placeholder={selected ? selected.salePrice : 'catalogue'}
          aria-invalid={errorFor(state, 'agreedPrice') ? true : undefined}
        />
      </div>

      <Submit variant="primary" pendingLabel="Allocating…">
        Allocate
      </Submit>
    </form>
  );
}

/**
 * The per-row actions: deliver what is in transit, send back what is on
 * site. Each is rendered only when its arithmetic permits it, so the
 * table never offers a button whose only outcome is a rejection.
 */
export function RowActions({
  projectId,
  productId,
  productName,
  unit,
  inTransit,
  onSite,
  warehouses,
}: {
  projectId: string;
  productId: string;
  productName: string;
  unit: string;
  /** Allocated but not yet handed over. */
  inTransit: string;
  /** Delivered, minus what has come back or been written off. */
  onSite: string;
  warehouses: { id: string; code: string; nameEn: string }[];
}) {
  const [open, setOpen] = useState<'deliver' | 'return' | null>(null);

  const canDeliver = Number(inTransit) > 0;
  const canReturn = Number(onSite) > 0 && warehouses.length > 0;

  if (!canDeliver && !canReturn) {
    return <span className="gts-meta">—</span>;
  }

  return (
    <div>
      <div className="gts-location-tools">
        {canDeliver && (
          <button
            type="button"
            className="gts-btn gts-btn-secondary gts-btn-xs"
            aria-expanded={open === 'deliver'}
            onClick={() => setOpen(open === 'deliver' ? null : 'deliver')}
          >
            Deliver
          </button>
        )}
        {canReturn && (
          <button
            type="button"
            className="gts-btn gts-btn-ghost gts-btn-xs"
            aria-expanded={open === 'return'}
            onClick={() => setOpen(open === 'return' ? null : 'return')}
          >
            Return
          </button>
        )}
      </div>

      {open === 'deliver' && (
        <DeliverForm
          projectId={projectId}
          productId={productId}
          productName={productName}
          unit={unit}
          inTransit={inTransit}
          onDone={() => setOpen(null)}
        />
      )}

      {open === 'return' && (
        <ReturnForm
          projectId={projectId}
          productId={productId}
          productName={productName}
          unit={unit}
          onSite={onSite}
          warehouses={warehouses}
          onDone={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function DeliverForm({
  projectId,
  productId,
  productName,
  unit,
  inTransit,
  onDone,
}: {
  projectId: string;
  productId: string;
  productName: string;
  unit: string;
  inTransit: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(submitDeliverToProject, null);

  return (
    <form action={formAction} className="gts-assign-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          Delivery recorded against the client statement.
        </p>
      )}

      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="productId" value={productId} />

      <div className="gts-field" style={{ flex: '0 1 9rem' }}>
        <label className="gts-label" htmlFor={`deliver-qty-${productId}`}>
          Deliver ({unit})
        </label>
        <input
          id={`deliver-qty-${productId}`}
          name="quantity"
          type="number"
          step="0.001"
          min="0"
          max={inTransit}
          defaultValue={inTransit}
          required
          className="gts-input gts-input-num"
          aria-describedby={`deliver-help-${productId}`}
          aria-invalid={errorFor(state, 'quantity') ? true : undefined}
        />
        <p className="gts-help" id={`deliver-help-${productId}`}>
          {inTransit} {unit} of {productName} in transit.
        </p>
      </div>

      <div className="gts-field" style={{ flex: '1 1 11rem' }}>
        <label className="gts-label" htmlFor={`deliver-ref-${productId}`}>
          Reference
        </label>
        <input
          id={`deliver-ref-${productId}`}
          name="reference"
          className="gts-input"
          placeholder="Delivery note no."
        />
      </div>

      <Submit variant="primary" pendingLabel="Recording…">
        Record delivery
      </Submit>
      <button type="button" className="gts-btn gts-btn-ghost gts-btn-sm" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

function ReturnForm({
  projectId,
  productId,
  productName,
  unit,
  onSite,
  warehouses,
  onDone,
}: {
  projectId: string;
  productId: string;
  productName: string;
  unit: string;
  onSite: string;
  warehouses: { id: string; code: string; nameEn: string }[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(submitReturnFromProject, null);
  const [damaged, setDamaged] = useState(false);

  return (
    <form action={formAction} className="gts-assign-form">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          {damaged
            ? 'Written off — the ledger keeps the loss rather than restocking the units.'
            : 'Returned. The units are back on the shelf and available again.'}
        </p>
      )}

      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="productId" value={productId} />

      <div className="gts-field" style={{ flex: '0 1 9rem' }}>
        <label className="gts-label" htmlFor={`return-qty-${productId}`}>
          Quantity ({unit})
        </label>
        <input
          id={`return-qty-${productId}`}
          name="quantity"
          type="number"
          step="0.001"
          min="0"
          max={onSite}
          required
          className="gts-input gts-input-num"
          aria-describedby={`return-help-${productId}`}
          aria-invalid={errorFor(state, 'quantity') ? true : undefined}
        />
        <p className="gts-help" id={`return-help-${productId}`}>
          {onSite} {unit} of {productName} still on site.
        </p>
      </div>

      <div className="gts-field" style={{ flex: '1 1 11rem' }}>
        <label className="gts-label" htmlFor={`return-warehouseId-${productId}`}>
          {damaged ? 'Write off against' : 'Back into'}
        </label>
        <select
          id={`return-warehouseId-${productId}`}
          name="warehouseId"
          required
          className="gts-input gts-select"
          defaultValue={warehouses[0]?.id ?? ''}
          aria-invalid={errorFor(state, 'warehouseId') ? true : undefined}
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.nameEn}
            </option>
          ))}
        </select>
      </div>

      <div className="gts-field" style={{ flex: '1 1 11rem' }}>
        <label className="gts-label" htmlFor={`return-reason-${productId}`}>
          Reason
        </label>
        <input
          id={`return-reason-${productId}`}
          name="reason"
          className="gts-input"
          placeholder={damaged ? 'Crushed in transit' : 'Surplus to requirement'}
        />
      </div>

      <div className="gts-field" style={{ flex: '1 1 13rem' }}>
        <label className="gts-label" htmlFor={`return-damaged-${productId}`}>
          <input
            id={`return-damaged-${productId}`}
            name="damaged"
            type="checkbox"
            checked={damaged}
            onChange={(event) => setDamaged(event.target.checked)}
          />{' '}
          Damaged — write off rather than restock
        </label>
      </div>

      <Submit variant="primary" pendingLabel="Recording…">
        {damaged ? 'Write off' : 'Return to stock'}
      </Submit>
      <button type="button" className="gts-btn gts-btn-ghost gts-btn-sm" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}
