import { describe, it, expect } from 'vitest';

import { workingDaysBetween as server } from '@/lib/services/leave';
import { workingDaysBetween as client } from '@/app/leave/working-days';

/**
 * The client-side working-day count must agree with the server's.
 *
 * `app/leave/working-days.ts` duplicates the calendar arithmetic because
 * the service is `server-only` and a form cannot import it. Duplicated
 * logic drifts unless something forces it not to — this is that thing.
 *
 * If these ever disagree, the requester sees one figure and is charged
 * another, which is exactly the kind of quiet wrongness that erodes
 * trust in a leave balance.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('client and server agree on working days', () => {
  const cases: [string, string, number][] = [
    // Thu → Sun: Thu and Sun are working, Fri and Sat are the weekend.
    ['2026-08-20', '2026-08-23', 2],
    // A full Sunday–Thursday week.
    ['2026-08-23', '2026-08-27', 5],
    // A single working day.
    ['2026-08-24', '2026-08-24', 1],
    // Weekend only.
    ['2026-08-21', '2026-08-22', 0],
    // Reversed range.
    ['2026-08-27', '2026-08-23', 0],
    // Across a month boundary.
    ['2026-08-27', '2026-09-03', 6],
    // A whole month.
    ['2026-09-01', '2026-09-30', 22],
  ];

  for (const [from, to, expected] of cases) {
    it(`${from} → ${to} is ${expected} working days in both`, () => {
      expect(server(d(from), d(to))).toBe(expected);
      expect(client(d(from), d(to))).toBe(expected);
    });
  }

  it('agrees across a year of random ranges', () => {
    // A sweep rather than a handful of dates: the two implementations
    // must agree everywhere, not only where somebody thought to look.
    for (let i = 0; i < 400; i += 1) {
      const start = new Date(Date.UTC(2026, 0, 1));
      start.setUTCDate(start.getUTCDate() + Math.floor(Math.random() * 365));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + Math.floor(Math.random() * 45));

      expect(client(start, end), `${start.toISOString()} → ${end.toISOString()}`).toBe(
        server(start, end),
      );
    }
  });
});
