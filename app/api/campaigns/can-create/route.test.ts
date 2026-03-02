import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted so the mock fn is available before vi.mock factories run
const { mockLoggerError } = vi.hoisted(() => ({
	mockLoggerError: vi.fn(),
}));

// Mock auth to throw an error (triggers the catch block)
vi.mock('@/lib/auth/get-auth-or-test', () => ({
	getAuthOrTest: vi.fn().mockRejectedValue(new Error('Simulated auth failure')),
}));

// Mock the billing module
vi.mock('@/lib/billing', () => ({
	validateCampaignCreation: vi.fn(),
}));

// Spy on the logger
vi.mock('@/lib/logging', () => ({
	createCategoryLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: mockLoggerError,
		debug: vi.fn(),
	}),
	LogCategory: { BILLING: 'billing' },
}));

vi.mock('@/lib/logging/console-proxy', () => ({
	structuredConsole: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from './route';

describe('GET /api/campaigns/can-create', () => {
	beforeEach(() => {
		mockLoggerError.mockClear();
	});

	it('returns allowed: false on auth error (fail-closed)', async () => {
		const response = await GET();
		const body = await response.json();

		expect(body.allowed).toBe(false);
	});

	it('logs failureMode as fail-closed', async () => {
		await GET();

		expect(mockLoggerError).toHaveBeenCalledTimes(1);

		const [message, _error, metadata] = mockLoggerError.mock.calls[0];
		expect(message).toBe('Campaign creation validation failed - denying request');
		expect(metadata.failureMode).toBe('fail-closed');
		expect(metadata.securityNote).toBe(
			'Validation failure prevents campaign creation as a safety measure'
		);
	});
});
