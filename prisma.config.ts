import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * Connection URLs live here rather than in schema.prisma. Two endpoints
 * are in play and the distinction matters:
 *
 *   DIRECT_URL  — the non-pooled Neon endpoint. Migrate uses it because
 *                 PgBouncer in transaction mode cannot hold the
 *                 session-level advisory locks a migration takes.
 *   DATABASE_URL— the pooled (-pooler) endpoint, used by the application
 *                 at runtime through the Neon driver adapter.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
    // Neon cannot create/drop databases on the fly, so the shadow is a
    // real database provisioned once on the same project. It only ever
    // holds Migrate's drift-detection replay — never application data.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? '',
  },
});
