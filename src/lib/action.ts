import 'server-only';

import { z } from 'zod';

import { requireActor, requirePermission, requestMeta, ForbiddenError, UnauthenticatedError, type Actor } from './auth';
import type { PermissionKey } from './permissions';
import { isDomainError } from './errors';

/**
 * GTS — the server action wrapper.
 *
 * Every mutation in the application goes through `action()`. That is the
 * point: authorization, validation and error shaping happen in ONE place,
 * so a new form cannot accidentally ship without a permission check
 * because its author forgot to write one.
 *
 * The wrapper enforces the order that matters:
 *   1. authenticate  — who is this?
 *   2. authorize     — may they do this? (server-side, from the database)
 *   3. validate      — is the input well-formed? (Zod, server-side)
 *   4. run           — only now does business logic see the data
 *
 * Authorization precedes validation deliberately: someone with no
 * permission should not be able to probe the shape of a form by reading
 * its validation errors.
 */

/* ============================================================
   RESULT
   ============================================================ */

export type { ActionResult, FieldErrors } from './action-result';
import type { ActionResult } from './action-result';

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: string,
  message: string,
  extra?: { fieldErrors?: Record<string, string[]>; detail?: Record<string, unknown> },
): ActionResult<never> {
  return { ok: false, code, message, ...extra };
}

/* ============================================================
   ERROR TRANSLATION
   ============================================================ */

/**
 * Turn a thrown error into a result the UI can render.
 *
 * Known domain errors keep their code, message and detail — those are
 * written for the user and carry things a screen needs, like the distance
 * to a site or the quantity actually available.
 *
 * Anything else is logged and replaced with a generic message: an
 * unexpected error's text may contain a query, a column name or a
 * connection string, none of which belong on a user's screen.
 */
export function toResult(error: unknown): ActionResult<never> {
  if (error instanceof UnauthenticatedError) {
    return fail('UNAUTHENTICATED', 'Your session has ended. Sign in again to continue.');
  }
  if (error instanceof ForbiddenError) {
    return fail('FORBIDDEN', error.message, { detail: { permission: error.permission } });
  }

  // Every service error extends DomainError, so this one check covers
  // them all — including services written after this file. A per-class
  // list would silently degrade a new service's careful messages into
  // "Something went wrong" the day somebody forgot to extend it.
  if (isDomainError(error)) {
    return fail(error.code, error.message, { detail: error.detail });
  }

  if (error instanceof z.ZodError) {
    return fail('VALIDATION', 'Check the highlighted fields.', {
      fieldErrors: flattenZodErrors(error),
    });
  }

  // Prisma's unique-constraint violation, surfaced usefully rather than
  // as an opaque failure.
  if (isPrismaError(error, 'P2002')) {
    const target = (error.meta?.target as string[] | undefined)?.join(', ');
    return fail(
      'DUPLICATE',
      target
        ? `Another record already uses that ${target}.`
        : 'Another record already uses one of those values.',
    );
  }
  if (isPrismaError(error, 'P2003')) {
    return fail('REFERENCE', 'That record is referenced elsewhere and cannot be changed this way.');
  }
  if (isPrismaError(error, 'P2025')) {
    return fail('NOT_FOUND', 'That record no longer exists.');
  }
  // A CHECK constraint fired — the database refused something the service
  // should have caught. Worth logging loudly.
  if (isPrismaError(error, 'P2010') || /violates check constraint/i.test(String(error))) {
    console.error('[action] database constraint rejected a write:', error);
    return fail('CONSTRAINT', 'That change would leave the records in an impossible state.');
  }

  console.error('[action] unhandled error:', error);
  return fail('UNEXPECTED', 'Something went wrong. Nothing was saved.');
}

function isPrismaError(error: unknown, code: string): error is { code: string; meta?: Record<string, unknown> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

/** Zod's flatten, but always string[] per field including nested paths. */
function flattenZodErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/* ============================================================
   THE WRAPPER
   ============================================================ */

interface ActionContext {
  actor: Actor;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ActionOptions<TInput, TOutput> {
  /** The permission required. Omit only for actions any signed-in user
   *  may take on their own records — and say why in a comment. */
  permission?: PermissionKey;
  input?: z.ZodType<TInput>;
  handler: (input: TInput, context: ActionContext) => Promise<TOutput>;
}

/**
 * Define a server action.
 *
 * Returns a function that takes the raw input and produces an
 * ActionResult — it never throws, so a form can always render an error
 * rather than falling into an error boundary.
 */
export function action<TInput, TOutput>(options: ActionOptions<TInput, TOutput>) {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    try {
      // 1 + 2: who, and may they.
      const actor = options.permission
        ? await requirePermission(options.permission)
        : await requireActor();

      // 3: shape. Only after authorization, so validation errors do not
      // become an oracle for someone who may not use this action at all.
      const input = options.input
        ? options.input.parse(rawInput)
        : (rawInput as TInput);

      const meta = await requestMeta();

      // 4: the work.
      const data = await options.handler(input, {
        actor,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return ok(data);
    } catch (error) {
      return toResult(error);
    }
  };
}

/* ============================================================
   FORM DATA

   Server actions receive FormData from a progressively-enhanced form.
   These helpers turn it into the plain object Zod expects, without
   every action re-implementing the same coercions.
   ============================================================ */

/** FormData → plain object. Repeated keys become arrays. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // File uploads are handled by their own route, not by an action.
    if (value instanceof File) continue;

    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }

  return out;
}

/**
 * Parse repeated indexed form fields into an array of objects.
 *
 * A bill's line items post as `lines[0].quantity`, `lines[0].unitPrice`,
 * `lines[1].quantity` … and come back as a proper array. This is what
 * lets a no-JavaScript form submit a multi-line invoice.
 */
export function formToArray(formData: FormData, prefix: string): Record<string, string>[] {
  const rows = new Map<number, Record<string, string>>();
  const pattern = new RegExp(`^${prefix}\\[(\\d+)\\]\\.(.+)$`);

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    const match = pattern.exec(key);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2]!;
    const row = rows.get(index) ?? {};
    row[field] = String(value);
    rows.set(index, row);
  }

  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

/* ============================================================
   SHARED SCHEMAS
   ============================================================ */

/** An HTML number input posts a string; this coerces and rejects NaN. */
export const numeric = (message = 'Enter a number') =>
  z.coerce.number({ message }).refine(Number.isFinite, message);

/** A date input posts 'YYYY-MM-DD'; DATE columns want midnight UTC. */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date as YYYY-MM-DD')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

/**
 * An optional text field: empty string means "not provided", not "".
 *
 * `.optional()` matters as much as `.nullable()`. A form that does not
 * render the input at all — an allocate form with no notes box — posts
 * no key for it, and `formToObject` therefore omits it. Without
 * `.optional()` the schema rejects the whole submission on a field the
 * user was never shown, and the form has no input to hang the error on,
 * so the screen simply does nothing. Both absent and null mean the same
 * thing here: not provided.
 */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const requiredText = (field: string, max = 500) =>
  z.string().trim().min(1, `${field} is required`).max(max, `${field} is too long`);

/** A cuid, as Prisma generates. Rejects a guessed or malformed id early. */
export const id = z.string().min(1, 'Missing identifier').max(64);

/** An HTML checkbox posts 'on' when ticked and nothing when not. */
export const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.literal('false'), z.undefined(), z.null()])
  .transform((v) => v === 'on' || v === 'true');
