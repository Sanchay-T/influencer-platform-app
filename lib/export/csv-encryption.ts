import crypto from 'crypto';

const MAGIC = Buffer.from('GEMZCSV1', 'utf8');
const IV_LENGTH_BYTES = 12; // AES-GCM recommended
const AUTH_TAG_LENGTH_BYTES = 16; // default for Node's AES-GCM

function parseEncryptionKey(): Buffer {
	const raw = process.env.CSV_EXPORT_ENCRYPTION_KEY;
	if (!raw) {
		throw new Error(
			'CSV_EXPORT_ENCRYPTION_KEY must be configured (32 bytes, hex or base64) to encrypt/decrypt CSV exports.'
		);
	}

	const trimmed = raw.trim();

	// Prefer hex when the string looks like hex, otherwise treat as base64.
	const looksHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
	const key = looksHex ? Buffer.from(trimmed, 'hex') : Buffer.from(trimmed, 'base64');

	if (key.length !== 32) {
		throw new Error(
			`CSV_EXPORT_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`
		);
	}

	return key;
}

export function encryptCsvBytes(plaintext: Uint8Array): Buffer {
	const key = parseEncryptionKey();
	const iv = crypto.randomBytes(IV_LENGTH_BYTES);

	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();

	return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decryptCsvBytes(envelope: Uint8Array): Buffer {
	const key = parseEncryptionKey();
	const data = Buffer.from(envelope);

	const minLength = MAGIC.length + IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES + 1;
	if (data.length < minLength) {
		throw new Error('Encrypted CSV payload is too short.');
	}

	const magic = data.subarray(0, MAGIC.length);
	if (!magic.equals(MAGIC)) {
		throw new Error('Encrypted CSV payload has invalid header.');
	}

	const ivStart = MAGIC.length;
	const ivEnd = ivStart + IV_LENGTH_BYTES;
	const tagStart = ivEnd;
	const tagEnd = tagStart + AUTH_TAG_LENGTH_BYTES;

	const iv = data.subarray(ivStart, ivEnd);
	const tag = data.subarray(tagStart, tagEnd);
	const ciphertext = data.subarray(tagEnd);

	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);

	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

