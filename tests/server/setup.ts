import 'dotenv/config';

/**
 * Server tests talk to the real database.
 *
 * They use the DIRECT (non-pooled) Neon endpoint: these tests open
 * explicit transactions and take row locks, and PgBouncer in transaction
 * mode cannot guarantee that two statements from the same test land on
 * the same backend connection.
 */
if (!process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL is not set — server tests need a real database. See .env.example.');
}

process.env.DATABASE_URL = process.env.DIRECT_URL;

// `server-only` throws outside a React Server Component. The modules
// under test are legitimately server-only; the guard just has no way to
// know it is already running on a server here.
// NODE_ENV is set by Vitest itself; nothing to do here.
