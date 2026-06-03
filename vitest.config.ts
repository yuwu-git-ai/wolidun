import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // Default: node environment for API tests
    // Use // @vitest-environment jsdom for React component tests
    environment: 'node',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'dist-server'],
    // Server tests need the DB path to be isolated
    env: {
      DB_PATH: './data/test-ordering.db',
      PORT: '3002',
    },
  },
});
