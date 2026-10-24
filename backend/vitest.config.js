import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.js'],
		setupFiles: ['./tests/setup.js'],
		hookTimeout: 180_000,
		testTimeout: 30_000,
		env: {
			NODE_ENV: 'test',
			JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256',
			JWT_EXPIRES_IN: '1d',
			JWT_COOKIE_EXPIRES_IN: '1',
			FRONTEND_URL: 'http://localhost:8080',
			API_RATE_LIMIT: '100000',
			S3_BUCKET: 'test',
		},
	},
});
