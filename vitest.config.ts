import { defineConfig } from 'vitest/config';

import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./packages/web/src', import.meta.url)) } },
  test: {
    include: ['netlify/**/*.test.ts', 'server/**/*.test.ts', 'packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 60000,
  },
});
