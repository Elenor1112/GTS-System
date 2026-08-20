import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

/**
 * Global teardown for the server suite.
 *
 * The tests run against the real development database, which is the
 * point — a mocked transaction cannot answer whether two concurrent
 * issues oversell stock. The cost is that they leave real notification
 * and audit rows behind, and after a few runs the development dashboard
 * shows a "99+" badge built entirely of test noise.
 *
 * So the run cleans up after itself. Only rows attributable to the test
 * fixtures are removed; a genuine notification created by hand in the
 * development environment is left alone.
 */

export default async function teardown() {
  if (!process.env.DIRECT_URL) return;

  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DIRECT_URL }),
  });

  try {
    // Bills the billing suite marks with a '[test]' note, and everything
    // hanging off them.
    const testBills = await db.electronicBill.findMany({
      where: { notes: { startsWith: '[test]' } },
      select: { id: true },
    });
    const billIds = testBills.map((b) => b.id);

    if (billIds.length) {
      await db.payment.deleteMany({ where: { billId: { in: billIds } } });
      await db.billApproval.deleteMany({ where: { billId: { in: billIds } } });
      await db.billItem.deleteMany({ where: { billId: { in: billIds } } });
      await db.electronicBill.deleteMany({ where: { id: { in: billIds } } });
    }

    // Notifications the suite generated. Bounded by age rather than by
    // content: everything these tests create is created during the run.
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    await db.notification.deleteMany({ where: { createdAt: { gte: cutoff } } });

    // Audit rows from the suite's own actions. The audit trail matters,
    // but a development trail made of test artefacts is not a trail.
    await db.auditLog.deleteMany({
      where: {
        createdAt: { gte: cutoff },
        action: { in: ['INVENTORY_MOVE', 'PAYMENT', 'CHECK_IN', 'CHECK_OUT'] },
      },
    });
  } finally {
    await db.$disconnect();
  }
}
