import { describe, expect, it } from 'vitest';
import { decryptCsvBytes, encryptCsvBytes } from './csv-encryption';

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

describe('csv-encryption', () => {
	it('encrypts and decrypts (roundtrip)', () => {
		const keyHex =
			'000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

		withEnv({ CSV_EXPORT_ENCRYPTION_KEY: keyHex }, () => {
			const plaintext = Buffer.from('id,email\n1,test@example.com\n', 'utf8');
			const encrypted = encryptCsvBytes(plaintext);
			expect(encrypted.equals(plaintext)).toBe(false);

			const decrypted = decryptCsvBytes(encrypted);
			expect(decrypted.toString('utf8')).toBe(plaintext.toString('utf8'));
		});
	});

	it('rejects invalid payloads', () => {
		const keyHex =
			'000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

		withEnv({ CSV_EXPORT_ENCRYPTION_KEY: keyHex }, () => {
			expect(() => decryptCsvBytes(Buffer.from('not-an-envelope'))).toThrow(
				/invalid header|too short/i
			);
		});
	});
});

