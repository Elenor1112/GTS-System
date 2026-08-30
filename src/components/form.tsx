'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult, errorFor } from '@/lib/action-result';

export { errorFor };
export type { ActionResult, FieldErrors } from '@/lib/action-result';

/**
 * GTS — form primitives.
 *
 * Built around the platform's own form, not around a controlled-input
 * library: every field is uncontrolled with a `defaultValue`, so a form
 * submits and re-renders its errors even before JavaScript has loaded.
 * The client layer adds a pending state and inline errors; it does not
 * add the ability to submit.
 *
 * Errors arrive from the server in `ActionResult.fieldErrors`, keyed by
 * field name — the same keys Zod produced — so a validation rule added
 * on the server displays in the right place without touching the form.
 */


/** A form-level message: a failure that belongs to the attempt, not a field. */
export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  // A pure field-validation failure is already shown beside each field;
  // repeating "check the highlighted fields" above them adds nothing.
  if (state.code === 'VALIDATION' && state.fieldErrors) return null;

  return (
    <div className="gts-form-error" role="alert" data-testid="form-error">
      {state.message}
    </div>
  );
}

export function Field({
  name,
  label,
  hint,
  error,
  required,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="gts-field">
      <label className="gts-label" htmlFor={name}>
        {label}
        {required && (
          <span className="gts-required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {/* The control is cloned by the caller with id/name already set;
          this wrapper only owns the label, hint and error. */}
      {children}
      {error ? (
        <p className="gts-help gts-help-error" id={`${name}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="gts-help" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Text input wired to the field conventions. */
export function TextField({
  name,
  label,
  hint,
  error,
  required,
  type = 'text',
  defaultValue,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'password';
  defaultValue?: string | number | null;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  maxLength?: number;
}) {
  return (
    <Field name={name} label={label} hint={hint} error={error} required={required}>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        // Money and quantities take the numeric face so decimal points
        // stack down a column of inputs the way they do in a table.
        className={`gts-input${inputMode === 'decimal' || inputMode === 'numeric' ? ' gts-input-num' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
      />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  error,
  required,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}) {
  return (
    <Field name={name} label={label} hint={hint} error={error} required={required}>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ''}
        className="gts-input gts-select"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * A select whose last option is "Other" — choosing it reveals a text
 * input (posted under `${name}Other`) instead of constraining the value
 * to the fixed list.
 *
 * `defaultValue` may be any free-text value that isn't one of `options`;
 * that case starts the control already switched to "Other" with the text
 * box pre-filled, so editing a record saved before an option existed (or
 * with a one-off value) doesn't silently discard it.
 */
export function SelectWithOtherField({
  name,
  label,
  hint,
  error,
  required,
  defaultValue,
  options,
  placeholder,
  otherLabel = 'Other',
  otherPlaceholder,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  defaultValue?: string | null;
  options: readonly string[];
  placeholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
}) {
  const knownValue = defaultValue && options.includes(defaultValue) ? defaultValue : '';
  const startsAsOther = Boolean(defaultValue) && !knownValue;
  const [isOther, setIsOther] = useState(startsAsOther);

  return (
    <>
      <Field name={name} label={label} hint={isOther ? undefined : hint} error={error} required={required}>
        <select
          id={name}
          name={name}
          required={required}
          defaultValue={isOther ? otherLabel : knownValue}
          onChange={(e) => setIsOther(e.target.value === otherLabel)}
          className="gts-input gts-select"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={otherLabel}>{otherLabel}</option>
        </select>
      </Field>
      {isOther && (
        <Field name={`${name}Other`} label={otherLabel} hint={hint}>
          <input
            id={`${name}Other`}
            name={`${name}Other`}
            type="text"
            defaultValue={startsAsOther ? defaultValue ?? '' : ''}
            placeholder={otherPlaceholder}
            maxLength={100}
            className="gts-input"
          />
        </Field>
      )}
    </>
  );
}

export function TextArea({
  name,
  label,
  hint,
  error,
  defaultValue,
  rows = 3,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <Field name={name} label={label} hint={hint} error={error}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? undefined}
        className="gts-input gts-textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
      />
    </Field>
  );
}

/**
 * The submit button.
 *
 * Reads `useFormStatus`, so it disables itself during submission without
 * the parent having to thread a pending flag down. Disabling is what
 * prevents a double-click from posting a second bill.
 */
const SUBMIT_VARIANT_CLASS: Record<'primary' | 'accent' | 'secondary' | 'danger', string> = {
  primary: 'bg-brand text-fg-on-accent hover:opacity-90',
  accent: 'bg-brand text-fg-on-accent hover:opacity-90',
  secondary: 'border border-line bg-surface text-fg hover:bg-hover',
  danger: 'bg-danger text-fg-on-accent hover:opacity-90',
};

export function Submit({
  children = 'Save',
  pendingLabel,
  variant = 'primary',
}: {
  children?: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'accent' | 'secondary' | 'danger';
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`h-touch px-4 rounded-sm text-sm font-medium transition-colors disabled:opacity-50 ${SUBMIT_VARIANT_CLASS[variant]}`}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel ?? 'Saving…' : children}
    </button>
  );
}

/** A row of form actions, pinned below the fields. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="gts-form-actions">{children}</div>;
}

/** Two-column field grid that collapses to one on narrow screens. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="gts-field-grid">{children}</div>;
}
