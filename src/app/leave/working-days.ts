/**
 * Working days in a date range — the client-side copy.
 *
 * Identical arithmetic to `workingDaysBetween` in
 * `lib/services/leave.ts`, duplicated here rather than imported because
 * that module is `server-only`: it opens transactions and takes row
 * locks, and pulling it into a form's bundle would fail the build.
 *
 * The duplication is deliberate and bounded — this is eleven lines of
 * calendar arithmetic with no dependencies, it is used ONLY to show the
 * requester what their range will cost before they submit, and the
 * server recomputes it regardless. The server's answer is the one that
 * is stored and charged against a balance.
 *
 * Friday (5) and Saturday (6) are the Egyptian weekend.
 */
export function workingDaysBetween(start: Date, end: Date): number {
  const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const to = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (to < from) return 0;

  let count = 0;
  const cursor = new Date(from);
  while (cursor.getTime() <= to) {
    const day = cursor.getUTCDay();
    if (day !== 5 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
