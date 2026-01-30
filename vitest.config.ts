import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        // Browser-dependent files (tested via e2e)
        'src/lib/scraper.ts',
        'src/lib/browser.ts',
        'src/lib/notify.ts',
      ],
      thresholds: {
        // 80% threshold on testable pure functions
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
