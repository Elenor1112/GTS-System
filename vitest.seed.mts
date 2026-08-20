import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config for the development activity seed.
 *
 * Separate from vitest.config.mts because the seed is not a test: it must
 * not run in the test suite, and it must not trigger the suite's global
 * teardown, which deletes exactly the notifications and audit rows the
 * seed has just generated.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(dir, 'src'),
      'server-only': path.join(dir, 'tests/server/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    /* The npm script names the file to run; this only bounds where
       Vitest will look. Never widen it to include tests/. */
    include: ['scripts/**/*.ts'],
    setupFiles: ['tests/server/setup.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
