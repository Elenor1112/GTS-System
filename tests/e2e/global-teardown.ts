import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

/**
 * Global teardown for the browser suite.
 *
 * These tests create real clients through the real form, which is the
 * point — the alternative proves nothing about whether the form works.
 * The cost is that a few runs leave the development directory full of
 * "First Company" and "After Rename", so the run removes what it made.
 *
 * Scoped by code prefix rather than by age: an E2E-prefixed code is
 * unambiguously ours, whereas a time window would sweep up a record a
 * developer happened to create while the suite was running.
 */
export default async function teardown() {
  if (!process.env.DIRECT_URL) return;

  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DIRECT_URL }),
  });

  try {
    /*
     * Notifications the run generated.
     *
     * Assigning somebody to a project notifies them, and a suite that
     * assigns on every `beforeEach` produces hundreds — which show up as
     * a permanent "99+" on the development rail. Bounded by age, since
     * these carry no test-specific marker and nothing else creates them
     * during a test run.
     */
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await db.notification.deleteMany({ where: { createdAt: { gte: cutoff } } });

    /*
     * Attendance the geofence tests recorded — TODAY's only.
     *
     * Scoped by `workDate`, not by `createdAt`. A createdAt window also
     * catches the seeded history, which is back-dated across three weeks
     * but was inserted minutes ago: the suite would silently erase the
     * development data it was meant to leave alone, and the dashboard
     * would report a workforce that never turned up.
     *
     * Today's row is the one that must go, so the next run is not
     * blocked by the one-check-in-per-day constraint.
     */
    const cairoToday = new Date(
      `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}T00:00:00.000Z`,
    );
    await db.attendance.deleteMany({ where: { workDate: cairoToday } });

    /*
     * Sessions are deliberately NOT deleted here.
     *
     * The temptation is obvious: a few runs leave hundreds of rows
     * against the administrator, and the Users screen dutifully reports
     * them. But the saved session file in `.playwright/` outlives this
     * teardown, so deleting the rows leaves the NEXT run holding a cookie
     * whose session no longer exists — and `getActor()` cannot tell a
     * deleted session from no session, so every authenticated page 500s
     * while the cookie looks perfectly valid.
     *
     * Deleting the file instead breaks the CURRENT run, because
     * Playwright resolves `storageState` per browser context rather than
     * once at startup. Both halves of that trade are worse than the
     * clutter.
     *
     * The application already solves this properly: `sweepExpiredSessions()`
     * runs on every sign-in and removes rows once they expire, twelve
     * hours after they were issued. Housekeeping belongs there, not in a
     * test teardown that cannot see the whole picture.
     */

    const testClients = await db.client.findMany({
      where: { code: { startsWith: 'E2E' } },
      select: { id: true },
    });
    const ids = testClients.map((c) => c.id);
    if (ids.length === 0) return;

    // Delete dependents first — the foreign keys are Restrict on purpose,
    // so a client with history cannot be silently removed.
    await db.payment.deleteMany({ where: { clientId: { in: ids } } });
    await db.clientProductTransaction.deleteMany({ where: { clientId: { in: ids } } });

    const bills = await db.electronicBill.findMany({
      where: { clientId: { in: ids } },
      select: { id: true },
    });
    const billIds = bills.map((b) => b.id);
    if (billIds.length) {
      await db.billApproval.deleteMany({ where: { billId: { in: billIds } } });
      await db.billItem.deleteMany({ where: { billId: { in: billIds } } });
      await db.electronicBill.deleteMany({ where: { id: { in: billIds } } });
    }

    await db.project.deleteMany({ where: { clientId: { in: ids } } });
    await db.client.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
}
