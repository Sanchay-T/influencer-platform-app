import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
	test: {
		globals: true,
		testTimeout: 30000,
		environmentMatchGlobs: [
			['app/components/**', 'jsdom'],
			['components/**', 'jsdom'],
		],
		setupFiles: ['./lib/test-utils/setup.ts'],
		include: ['**/*.test.{ts,tsx}'],
		exclude: ['node_modules', '.next', 'drizzle', 'gemz-landing'],
	},
});
