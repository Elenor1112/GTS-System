import { defineConfig } from 'vitest/config';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest covers the SERVER: the inventory ledger, the totals engine, the
 * geofence verdict, RBAC and the leave calculator — the logic where a
 * mistake costs money or lets someone check in from home.
 *
 * These run against the real Neon database through the DIRECT endpoint,
 * not a mock. A mocked transaction proves nothing about whether two
 * concurrent issues can drive stock negative, which is the exact
 * question worth asking.
 *
 * Playwright keeps the browser-level flows; the two do not overlap.
 */
export default defineConfig({

  resolve: {
    alias: {
      '@': path.join(dir, 'src'),
      // `server-only` exists to fail a BUILD when server code is pulled
      // into a client bundle. Under Vitest we are already on the server,
      // so it is stubbed rather than removed from the source — the guard
      // must stay real for the Next build, which is what it protects.
      'server-only': path.join(dir, 'tests/server/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/server/**/*.test.ts'],
    setupFiles: ['tests/server/setup.ts'],
    globalTeardown: ['tests/server/teardown.ts'],
    // Serialised: these tests share one database, and a parallel run
    // would have two files resetting the same product's ledger.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
