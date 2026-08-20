import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';

/*
 * WebSocket transport.
 *
 * Node 22+ ships a global WebSocket, which the Neon driver uses for the
 * pooled connection that carries transactions. Do NOT inject the `ws`
 * package here: its optional native `bufferutil` addon does not survive
 * Next's bundling, and every query then dies with
 * "bufferUtil.mask is not a function".
 */
if (typeof globalThis.WebSocket === 'undefined') {
  throw new Error(
    'No global WebSocket. GTS needs Node 22 or newer — the Neon driver uses it for transactions.',
  );
}

/**
 * The database client.
 *
 * Connects through the POOLED Neon endpoint via the driver adapter.
 * Serverless functions open and close connections constantly; without
 * pooling, Neon's connection limit is reached long before the load is
 * interesting.
 *
 * The global cache is not a micro-optimisation — Next's dev server
 * re-evaluates modules on every edit, and a fresh PrismaClient per
 * reload exhausts the pool within a few minutes of work.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill in the Neon connection string.',
    );
  }

  /*
   * Pool sizing.
   *
   * Neon's pooled endpoint has a finite budget, and a serverless runtime
   * can open a connection per concurrent request. Left unbounded, a burst
   * — several browser tabs, or a parallel test run hitting the heaviest
   * page — exhausts it and returns a 500 for a page whose query is
   * perfectly correct, which is a maddening thing to debug.
   *
   * Ten is comfortable for this application's shape (short reads, brief
   * serialisable writes) and well inside Neon's limit. `idleTimeoutMillis`
   * returns connections promptly rather than holding them across the
   * quiet stretches an office system spends most of its day in.
   */
  const adapter = new PrismaNeon({
    connectionString,
    /*
     * Twenty, and a generous acquisition timeout.
     *
     * A page here is not one query: /permissions reads roles, users and
     * the permission catalogue, and the shell resolves the session and
     * the unread count on top. Four concurrent browsers therefore want
     * far more than four connections at once.
     *
     * Sized too small, `getActor()` cannot acquire one in time — and
     * because a failed session lookup is indistinguishable from a
     * missing session, the page throws UnauthenticatedError and returns
     * a 500 for a request that was perfectly well authenticated. That
     * failure mode is worth the comment: it presents as an auth bug and
     * is really a pool bug.
     */
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
  });

  return new PrismaClient({
    adapter,
    // Queries are logged in development only. A production log of every
    // statement would leak client names and money into the log stream.
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Run work inside a serialisable-enough transaction.
 *
 * Every service that touches stock, bill totals or leave balances goes
 * through here rather than calling `db.$transaction` ad hoc, so the
 * timeout and isolation level are one decision rather than fifteen.
 *
 * `Serializable` is deliberate: the inventory engine reads a stock level
 * and then writes a new one derived from it, which is precisely the
 * read-modify-write that a weaker level allows two concurrent requests
 * to both perform against the same starting value.
 */
export function transaction<T>(
  fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
  options?: { timeout?: number },
): Promise<T> {
  return db.$transaction(fn, {
    isolationLevel: 'Serializable',
    timeout: options?.timeout ?? 15_000,
    maxWait: 5_000,
  });
}

/** The transaction-scoped client type, for services that accept either. */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Either the pooled client or an open transaction. */
export type DbClient = PrismaClient | Tx;
