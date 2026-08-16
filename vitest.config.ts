import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
    // Most suites build a Postgres in memory (PGlite) in beforeEach, which
    // blows past the 5s default on a loaded machine.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
