// #book ch02-shared-vitest
import { defineConfig } from 'vitest/config';
// ch02-dev-env/shared/vitest.config.ts

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
// #endbook
