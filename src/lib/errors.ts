/**
 * GTS — the domain error base.
 *
 * Every service error extends this. The action wrapper then recognises
 * them all with ONE `instanceof` check, rather than a list of class names
 * that has to be extended each time a service is added — a list which,
 * when someone forgets it, turns a careful message like "Client code
 * CL-006 is already in use" into "Something went wrong."
 *
 * Deliberately in its own module with no imports: `lib/action.ts` must be
 * able to depend on it without pulling in every service, and a service
 * must be able to depend on it without a cycle.
 */
export class DomainError extends Error {
  /** Machine-readable, for a form to branch on. */
  readonly code: string;
  /** Extra context a screen can use — a distance, an available quantity. */
  readonly detail: Record<string, unknown>;

  constructor(code: string, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Messages on a DomainError are written FOR THE USER and are safe to
 * display. Anything else is replaced with a generic message, because an
 * unexpected error's text may carry a query, a column name or a
 * connection string.
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
