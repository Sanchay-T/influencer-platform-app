import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment for DOM testing
    environment: 'jsdom',

    // Global test utilities
    globals: true,

    // Setup files run before each test file
    setupFiles: ['./testing/setup.ts'],

    // Include test files
    include: [
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
      'components/**/*.test.ts',
      'components/**/*.test.tsx',
      'testing/__tests__/**/*.test.ts',
      'testing/__tests__/**/*.test.tsx',
    ],

    // Exclude from tests
    exclude: [
      'node_modules',
      '.next',
      'testing/api-suite/**',
      'testing/e2e/**',
      'testing/smoke/**',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'testing/',
        'scripts/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
      ],
      // Coverage thresholds (start low, increase over time)
      thresholds: {
        statements: 20,
        branches: 20,
        functions: 20,
        lines: 20,
      },
    },

    // Reporter configuration
    reporters: ['verbose'],

    // Timeout for each test
    testTimeout: 10000,

    // Watch mode configuration
    watch: false,

    // Pool configuration (v4 style - top-level)
    isolate: true,
  },

  // Path aliases (match tsconfig)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
