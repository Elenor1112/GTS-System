'use client';

import { useEffect } from 'react';

/**
 * Open the print dialog once, on arrival.
 *
 * A separate client component so the page itself stays a server
 * component — this is the only thing on it that needs the browser.
 *
 * `requestAnimationFrame` rather than calling straight away: print()
 * snapshots the document synchronously, and firing it before the first
 * paint can produce a blank first page in Chromium. Waiting for a frame
 * means the layout the user sees is the layout that prints.
 */
export function AutoPrint() {
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
