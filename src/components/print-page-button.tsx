'use client';

/**
 * Print the current page in place, rather than navigating to a
 * dedicated print route. For a view like Reports that is itself a
 * filtered position rather than one record, the on-screen page already
 * IS the document — the global print stylesheet strips the rail, filter
 * bar and buttons, so there is nothing a separate route would add.
 */
export function PrintPageButton({ className = 'gts-btn gts-btn-secondary' }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      Print
    </button>
  );
}
