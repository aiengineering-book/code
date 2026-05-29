// #book ch02-vitest-config
import { defineConfig } from 'vitest/config';
// ch02-dev-env/server/vitest.config.ts

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'dist'],
    },
  },
});
// #endbook
