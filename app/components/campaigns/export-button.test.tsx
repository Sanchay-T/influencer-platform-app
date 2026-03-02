// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the component
vi.mock('react-hot-toast', () => ({
	toast: {
		loading: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		dismiss: vi.fn(),
	},
}));

vi.mock('@/lib/logging', () => ({
	campaignLogger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock('@/lib/logging/react-logger', () => ({
	useUserActionLogger: () => ({
		logClick: vi.fn(),
		logAction: vi.fn(),
	}),
}));

vi.mock('../error-boundary', () => ({
	ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
	Download: () => <span data-testid="download-icon" />,
	Loader2: () => <span data-testid="loader-icon" />,
}));

import ExportButton from './export-button';

describe('ExportButton exponential backoff', () => {
	let fetchCallTimes: number[];
	let fetchCallCount: number;

	beforeEach(() => {
		vi.useFakeTimers();
		fetchCallTimes = [];
		fetchCallCount = 0;

		// Mock fetch: first call returns exportId, subsequent calls return processing
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				const now = Date.now();
				fetchCallTimes.push(now);
				fetchCallCount++;

				if (url.includes('/api/export/csv')) {
					return {
						ok: true,
						json: async () => ({ exportId: 'test-export-123' }),
					};
				}
				if (url.includes('/api/export/status/')) {
					return {
						ok: true,
						json: async () => ({ status: 'processing' }),
					};
				}
				return { ok: false, json: async () => ({}) };
			})
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('uses exponential backoff for poll intervals', async () => {
		render(<ExportButton jobId="job-123" />);

		const button = screen.getByRole('button', { name: /export csv/i });

		// Click triggers: 1) POST /api/export/csv, then immediately 2) GET /api/export/status
		// pollExportStatus is called directly (not via setTimeout) after the initial request
		await act(async () => {
			fireEvent.click(button);
		});
		await act(async () => {
			await Promise.resolve();
		});

		// Initial export request + immediate first poll
		expect(fetchCallCount).toBe(2);

		// After first poll, backoff schedules next at 2000ms (2000 * 1.5^0)
		await act(async () => {
			vi.advanceTimersByTime(2001);
		});
		expect(fetchCallCount).toBe(3); // Second poll

		// Next poll at 3000ms (2000 * 1.5^1)
		await act(async () => {
			vi.advanceTimersByTime(2500);
		});
		expect(fetchCallCount).toBe(3); // Not yet

		await act(async () => {
			vi.advanceTimersByTime(501);
		});
		expect(fetchCallCount).toBe(4); // Third poll

		// Next poll at 4500ms (2000 * 1.5^2)
		await act(async () => {
			vi.advanceTimersByTime(4000);
		});
		expect(fetchCallCount).toBe(4); // Not yet

		await act(async () => {
			vi.advanceTimersByTime(501);
		});
		expect(fetchCallCount).toBe(5); // Fourth poll

		// Verify delays are increasing (exponential backoff)
		// fetchCallTimes[0] = initial export request
		// fetchCallTimes[1] = immediate first poll (same time)
		// fetchCallTimes[2] = second poll (~2000ms later)
		// fetchCallTimes[3] = third poll (~3000ms later)
		// fetchCallTimes[4] = fourth poll (~4500ms later)
		const delay1 = fetchCallTimes[3] - fetchCallTimes[2]; // ~3000ms
		const delay2 = fetchCallTimes[4] - fetchCallTimes[3]; // ~4500ms

		expect(delay2).toBeGreaterThan(delay1); // Increasing delays confirm backoff
	});
});
