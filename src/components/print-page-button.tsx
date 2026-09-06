'use client';

/**
 * Print the current page in place, rather than navigating to a
 * dedicated print route. For a view like Reports that is itself a
 * filtered position rather than one record, the on-screen page already
 * IS the document — the global print stylesheet strips the rail, filter
 * bar and buttons, so there is nothing a separate route would add.
 */
export function PrintPageButton({
  label,
  className = 'gts-btn gts-btn-secondary',
}: {
  /** Passed in by the caller: this is a client component, and the
   *  dictionary is server-only, so it cannot resolve its own label. */
  label: string;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
