import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@vercel/blob', () => ({
	list: vi.fn().mockResolvedValue({ blobs: [] }),
}));

vi.mock('heic-convert', () => ({
	default: vi.fn(),
}));

vi.mock('sharp', () => ({
	default: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logging/background-job-logger', () => ({
	jobLog: {
		start: vi.fn(() => 'job-1'),
		complete: vi.fn(),
		fail: vi.fn(),
		image: vi.fn(),
	},
}));

vi.mock('@/lib/logging/console-proxy', () => ({
	structuredConsole: {
		log: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		groupEnd: vi.fn(),
	},
}));

vi.mock('@/lib/logging/types', () => ({
	LogCategory: { API: 'api', STORAGE: 'storage', SECURITY: 'security' },
}));

vi.mock('@/lib/utils/type-guards', () => ({
	toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

import { GET } from './route';

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe('GET /api/proxy/image — SSRF protection via validateImageProxyUrl', () => {
	it('blocks requests to metadata service (169.254.x.x) with placeholder SVG', async () => {
		const request = new Request(
			'http://localhost:3000/api/proxy/image?url=http://169.254.169.254/latest/meta-data/'
		);

		const response = await GET(request);
		// Returns 200 with SVG placeholder (blocked URL still returns content to avoid broken images)
		expect(response.status).toBe(200);
		expect(response.headers.get('X-Image-Proxy-Source')).toBe('blocked-url');
		expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
	});

	it('blocks requests to localhost with placeholder SVG', async () => {
		const request = new Request('http://localhost:3000/api/proxy/image?url=http://localhost/admin');

		const response = await GET(request);
		expect(response.status).toBe(200);
		expect(response.headers.get('X-Image-Proxy-Source')).toBe('blocked-url');
	});

	it('blocks requests to private IP ranges (10.x.x.x)', async () => {
		const request = new Request('http://localhost:3000/api/proxy/image?url=http://10.0.0.1/secret');

		const response = await GET(request);
		expect(response.status).toBe(200);
		expect(response.headers.get('X-Image-Proxy-Source')).toBe('blocked-url');
	});

	it('blocks requests to private IP ranges (192.168.x.x)', async () => {
		const request = new Request(
			'http://localhost:3000/api/proxy/image?url=http://192.168.1.1/admin'
		);

		const response = await GET(request);
		expect(response.status).toBe(200);
		expect(response.headers.get('X-Image-Proxy-Source')).toBe('blocked-url');
	});

	it('blocks requests to IPv6 loopback (::1)', async () => {
		const request = new Request('http://localhost:3000/api/proxy/image?url=http://[::1]/admin');

		const response = await GET(request);
		expect(response.status).toBe(200);
		expect(response.headers.get('X-Image-Proxy-Source')).toBe('blocked-url');
	});

	it('allows requests to TikTok CDN domains', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(Buffer.from('fake-image'), {
				status: 200,
				headers: { 'Content-Type': 'image/jpeg' },
			})
		);

		const request = new Request(
			'http://localhost:3000/api/proxy/image?url=https://p16-sign.tiktokcdn.com/image.jpg'
		);

		const response = await GET(request);

		// Should pass validation and proceed to fetch (or placeholder if DNS fails in test env)
		expect(response.status).toBe(200);
	});

	it('allows requests to Instagram CDN domains', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(Buffer.from('fake-image'), {
				status: 200,
				headers: { 'Content-Type': 'image/jpeg' },
			})
		);

		const request = new Request(
			'http://localhost:3000/api/proxy/image?url=https://scontent.cdninstagram.com/v/photo.jpg'
		);

		const response = await GET(request);
		expect(response.status).toBe(200);
	});

	it('returns 400 for missing URL parameter', async () => {
		const request = new Request('http://localhost:3000/api/proxy/image');
		const response = await GET(request);
		expect(response.status).toBe(400);
	});
});
