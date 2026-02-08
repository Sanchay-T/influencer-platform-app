import { describe, expect, it } from 'vitest';
import { dbPing } from './db-helpers';

describe('Test Infrastructure Smoke', () => {
	it('connects to the real database', async () => {
		const ok = await dbPing();
		expect(ok).toBe(true);
	});
});
