import { put } from '@vercel/blob';
import { describe, expect, it, vi } from 'vitest';

// Mock all external dependencies before imports
vi.mock('@upstash/qstash', () => ({
	Receiver: class {
		verify = vi.fn().mockResolvedValue(true);
	},
}));

vi.mock('@vercel/blob', () => ({
	put: vi.fn().mockResolvedValue({
		url: 'https://blob.vercel-storage.com/exports/test.csv',
		downloadUrl: 'https://blob.vercel-storage.com/exports/test.csv?download=1',
	}),
}));

vi.mock('@/lib/db', () => ({
	db: {
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
		query: {
			scrapingJobs: {
				findMany: vi.fn().mockResolvedValue([{ id: 'job-1', keywords: ['test'] }]),
				findFirst: vi.fn().mockResolvedValue({ keywords: ['test'] }),
			},
		},
	},
}));

vi.mock('@/lib/db/schema', () => ({
	exportJobs: { id: 'id' },
	scrapingJobs: { id: 'id', campaignId: 'campaignId' },
}));

vi.mock('@/lib/export/csv-utils', () => ({
	dedupeCreators: vi.fn((creators: unknown[]) => creators),
	dedupeByCreator: vi.fn((creators: unknown[]) => creators),
	formatEmailsForCsv: vi.fn(() => ''),
}));

vi.mock('@/lib/export/get-creators', () => ({
	getCreatorsForJobs: vi.fn().mockResolvedValue({
		creators: [
			{
				creator: { name: 'Test Creator', followers: 1000 },
				video: {
					url: 'https://tiktok.com/video',
					description: 'test',
					statistics: { views: 100, likes: 10, comments: 5, shares: 2 },
				},
				hashtags: ['test'],
				platform: 'TikTok',
				createTime: 1700000000,
				lengthSeconds: 30,
			},
		],
		source: 'db',
	}),
}));

vi.mock('@/lib/logging/console-proxy', () => ({
	structuredConsole: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/sentry', () => ({
	SentryLogger: {
		setContext: vi.fn(),
		addBreadcrumb: vi.fn(),
		captureException: vi.fn(),
		startSpanAsync: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
	},
}));

import { POST } from './route';

const mockPut = vi.mocked(put);

describe('POST /api/export/csv-worker', () => {
	it('uploads CSV with access: public and unguessable filename', async () => {
		const body = JSON.stringify({
			exportId: 'export-123',
			campaignId: 'campaign-456',
			userId: 'user-789',
		});

		const request = new Request('http://localhost:3000/api/export/csv-worker', {
			method: 'POST',
			body,
			headers: {
				'Upstash-Signature': 'test-signature',
			},
		});

		// Run in dev mode to skip signature verification
		vi.stubEnv('NODE_ENV', 'development');

		const response = await POST(request);
		const data = await response.json();

		vi.unstubAllEnvs();

		expect(data.success).toBe(true);

		// Verify blob put was called with correct options
		expect(mockPut).toHaveBeenCalledWith(
			expect.stringMatching(/^exports\/campaign-campaign-456-\d+-[a-f0-9-]+\.csv$/),
			expect.any(String),
			expect.objectContaining({
				access: 'public',
				contentType: 'text/csv',
			})
		);

		// Verify filename contains UUID token for unguessability
		const firstCall = mockPut.mock.calls[0];
		const filename = firstCall?.[0];
		if (typeof filename !== 'string') {
			throw new Error('Expected put() to be called with a filename string');
		}
		const parts = filename.split('-');
		// Should have UUID-format token at the end (before .csv)
		expect(parts.length).toBeGreaterThan(3);
	});
});
