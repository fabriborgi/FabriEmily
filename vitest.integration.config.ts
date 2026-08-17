import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    globals: true,
    fileParallelism: false,
    testTimeout: 20000,
    setupFiles: ['supabase/tests/setup.ts'],
  },
});
