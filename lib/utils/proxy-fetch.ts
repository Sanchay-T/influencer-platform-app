/**
 * Proxy fetch utility for Claude Code web sandbox
 *
 * In the Claude Code web sandbox, direct HTTP requests to external hosts are blocked.
 * This utility routes requests through a Supabase Edge Function proxy.
 *
 * @context Sandbox network restrictions bypass
 */

const PROXY_URL = 'https://cufwvosytcmaggyyfsix.supabase.co/functions/v1/proxy-fetch';

/**
 * Check if we should use the proxy
 * - Use proxy when USE_PROXY_FETCH env var is set
 * - Or when running in sandbox (detected by failed direct requests)
 */
const shouldUseProxy = (): boolean => {
	// Explicit opt-in via environment variable
	if (process.env.USE_PROXY_FETCH === 'true') {
		return true;
	}
	// In production, never use proxy
	if (process.env.NODE_ENV === 'production') {
		return false;
	}
	return false;
};

/**
 * Proxy-aware fetch that routes through Supabase Edge Function when needed
 *
 * @param url - The target URL to fetch
 * @param options - Standard fetch options
 * @returns Promise<Response> - The fetch response
 */
export async function proxyFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
	const targetUrl = url.toString();

	// If not using proxy, use regular fetch
	if (!shouldUseProxy()) {
		return fetch(targetUrl, options);
	}

	// Extract method and headers
	const method = options.method || 'GET';
	const headers =
		options.headers instanceof Headers
			? Object.fromEntries(options.headers.entries())
			: (options.headers as Record<string, string>) || {};

	// Build proxy request
	const proxyHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		'x-target-url': targetUrl,
		'x-target-method': method,
	};

	// Pass through target headers
	if (Object.keys(headers).length > 0) {
		proxyHeaders['x-target-headers'] = JSON.stringify(headers);
	}

	// Make proxy request
	const proxyOptions: RequestInit = {
		method: 'POST',
		headers: proxyHeaders,
	};

	// Pass body for methods that support it
	if (options.body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
		proxyOptions.body = options.body;
	}

	return fetch(PROXY_URL, proxyOptions);
}

/**
 * Helper to make a proxied GET request
 */
export async function proxyGet(url: string, headers?: Record<string, string>): Promise<Response> {
	return proxyFetch(url, { method: 'GET', headers });
}

/**
 * Helper to make a proxied POST request with JSON body
 */
export async function proxyPost(
	url: string,
	body: unknown,
	headers?: Record<string, string>
): Promise<Response> {
	return proxyFetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
		body: JSON.stringify(body),
	});
}
