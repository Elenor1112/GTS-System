/**
 * GTS — the result shape a server action returns.
 *
 * Deliberately in its own module, with NO imports.
 *
 * `lib/action.ts` is marked `server-only`, correctly — it reads cookies
 * and queries the database. But every form is a client component and
 * needs this type to render errors. Even `import type` from a
 * server-only module drags the module into the client graph under some
 * bundler configurations, and the build then fails with "You're
 * importing a component that needs server-only".
 *
 * Splitting the type out means the client imports a file that contains
 * nothing but types, and the guard on the server module stays intact.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      /** Machine-readable, for the form to branch on. */
      code: string;
      /** Human-readable, safe to show the user. */
      message: string;
      /** Per-field messages, keyed by field name, for inline display. */
      fieldErrors?: Record<string, string[]>;
      /** Extra context a screen can use — a distance, an available quantity. */
      detail?: Record<string, unknown>;
    };

/** Field errors as the forms consume them. */
export type FieldErrors = Record<string, string[]> | undefined;

/**
 * The message for one field, if the last submission rejected it.
 *
 * Pure, and safe on the client — which is the point of it living here
 * rather than beside the server-side action machinery.
 */
export function errorFor(
  state: ActionResult<unknown> | null,
  field: string,
): string | undefined {
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[field]?.[0];
}
