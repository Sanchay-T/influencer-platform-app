import { describe, expect, it } from 'vitest';
import { getQstashCallbackUrl, shouldVerifyQstashSignature } from './qstash-signature';

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
	const prev: Record<string, string | undefined> = {};
	for (const key of Object.keys(env)) {
		prev[key] = process.env[key];
		process.env[key] = env[key];
	}
	try {
		fn();
	} finally {
		for (const key of Object.keys(env)) {
			process.env[key] = prev[key];
		}
	}
}

describe('qstash-signature', () => {
	describe('shouldVerifyQstashSignature', () => {
		it('verifies in production even if VERIFY_QSTASH_SIGNATURE is not set', () => {
			withEnv(
				{
					NODE_ENV: 'production',
					VERIFY_QSTASH_SIGNATURE: undefined,
					SKIP_QSTASH_SIGNATURE: 'true',
				},
				() => {
					expect(shouldVerifyQstashSignature()).toBe(true);
				}
			);
		});

		it('does not verify in development unless explicitly enabled', () => {
			withEnv(
				{
					NODE_ENV: 'development',
					VERIFY_QSTASH_SIGNATURE: undefined,
				},
				() => {
					expect(shouldVerifyQstashSignature()).toBe(false);
				}
			);

			withEnv(
				{
					NODE_ENV: 'development',
					VERIFY_QSTASH_SIGNATURE: 'true',
				},
				() => {
					expect(shouldVerifyQstashSignature()).toBe(true);
				}
			);
		});

		it('does not verify in test unless explicitly enabled', () => {
			withEnv(
				{
					NODE_ENV: 'test',
					VERIFY_QSTASH_SIGNATURE: undefined,
				},
				() => {
					expect(shouldVerifyQstashSignature()).toBe(false);
				}
			);

			withEnv(
				{
					NODE_ENV: 'test',
					VERIFY_QSTASH_SIGNATURE: 'true',
				},
				() => {
					expect(shouldVerifyQstashSignature()).toBe(true);
				}
			);
		});
	});

	describe('getQstashCallbackUrl', () => {
		it('uses request host and https for non-localhost', () => {
			const req = new Request('https://example.com/anything', {
				headers: { host: 'usegemz.ngrok.app' },
			});

			expect(getQstashCallbackUrl(req, '/api/v2/worker/search')).toBe(
				'https://usegemz.ngrok.app/api/v2/worker/search'
			);
		});

		it('uses http for localhost', () => {
			const req = new Request('http://localhost/anything', {
				headers: { host: 'localhost:3001' },
			});

			expect(getQstashCallbackUrl(req, 'api/qstash/process-search')).toBe(
				'http://localhost:3001/api/qstash/process-search'
			);
		});
	});
});

