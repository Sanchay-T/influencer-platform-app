/**
 * Image Cache Service
 *
 * Caches creator images (avatars + thumbnails) to Vercel Blob for permanent storage.
 * Social media CDN URLs expire after hours/days - blob URLs are permanent.
 *
 * @context Solves the "old runs don't show images" problem by storing images
 * before the original URLs expire.
 *
 * Storage structure:
 *   images/avatars/{platform}/{username}.jpg
 *   images/thumbnails/{platform}/{contentId}.jpg
 */

import { createHash } from 'node:crypto';
import { head, put } from '@vercel/blob';
import { structuredConsole } from '@/lib/logging/console-proxy';

// ============================================================================
// Types
// ============================================================================

export interface CacheResult {
	originalUrl: string;
	cachedUrl: string;
	cached: boolean;
}

export interface CreatorImageUrls {
	avatarUrl?: string | null;
	thumbnailUrl?: string | null;
}

export interface CachedCreatorUrls {
	avatarUrl: string | null;
	thumbnailUrl: string | null;
	cacheStatus: {
		avatarCached: boolean;
		thumbnailCached: boolean;
	};
}

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[IMAGE-CACHE]';
const CONCURRENCY_LIMIT = 5; // Max parallel uploads
const FETCH_TIMEOUT = 10000; // 10 seconds

// ============================================================================
// ImageCache Class
// ============================================================================

export class ImageCache {
	/**
	 * Generate a deterministic cache key for an image
	 * Uses hash to handle special characters in URLs
	 */
	private generateCacheKey(
		type: 'avatars' | 'thumbnails',
		platform: string,
		identifier: string,
		originalUrl: string
	): string {
		// Use URL hash to ensure uniqueness even if identifier changes
		const urlHash = createHash('md5').update(originalUrl).digest('hex').slice(0, 8);
		const safeId = identifier.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
		return `images/${type}/${platform.toLowerCase()}/${safeId}-${urlHash}.jpg`;
	}

	/**
	 * Check if a URL is already a blob URL (no need to cache)
	 */
	private isBlobUrl(url: string): boolean {
		return url.includes('blob.vercel-storage.com');
	}

	/**
	 * Check if URL looks valid for caching
	 */
	private isValidUrl(url: string | null | undefined): url is string {
		if (!url || typeof url !== 'string') {
			return false;
		}
		const trimmed = url.trim();
		return trimmed.startsWith('http://') || trimmed.startsWith('https://');
	}

	/**
	 * Check if an image is already cached in blob storage
	 */
	private async checkExists(cacheKey: string): Promise<string | null> {
		try {
			const blob = await head(cacheKey);
			return blob?.url ?? null;
		} catch {
			// head() throws if blob doesn't exist
			return null;
		}
	}

	/**
	 * Download an image and upload to Vercel Blob
	 */
	private async downloadAndCache(
		url: string,
		cacheKey: string,
		platform: string
	): Promise<CacheResult> {
		try {
			// Build fetch headers based on platform
			const headers: Record<string, string> = {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
				Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
			};

			if (platform.toLowerCase() === 'tiktok') {
				headers.Referer = 'https://www.tiktok.com/';
				headers.Origin = 'https://www.tiktok.com';
			} else if (platform.toLowerCase() === 'instagram') {
				headers.Referer = 'https://www.instagram.com/';
			}

			// Fetch with timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

			const response = await fetch(url, {
				headers,
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`Fetch failed: ${response.status}`);
			}

			let buffer = Buffer.from(await response.arrayBuffer());

			// Convert HEIC to JPEG if needed
			if (url.includes('.heic') || url.includes('.heif')) {
				try {
					const convert = (await import('heic-convert')).default;
					const converted = await convert({
						buffer,
						format: 'JPEG',
						quality: 0.85,
					});
					buffer = Buffer.from(converted);
				} catch (_heicError) {
					structuredConsole.warn(`${LOG_PREFIX} HEIC conversion failed, using original`);
				}
			}

			// Upload to Vercel Blob
			const blob = await put(cacheKey, buffer, {
				access: 'public',
				contentType: 'image/jpeg',
			});

			structuredConsole.log(`${LOG_PREFIX} ✅ Cached: ${cacheKey}`);

			return {
				originalUrl: url,
				cachedUrl: blob.url,
				cached: true,
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			structuredConsole.warn(`${LOG_PREFIX} ❌ Cache failed for ${url.slice(0, 50)}...: ${msg}`);

			return {
				originalUrl: url,
				cachedUrl: url, // Return original URL as fallback
				cached: false,
			};
		}
	}

	/**
	 * Cache a single image URL
	 * Returns blob URL if successful, original URL if failed
	 */
	async cacheImage(
		originalUrl: string,
		type: 'avatars' | 'thumbnails',
		platform: string,
		identifier: string
	): Promise<CacheResult> {
		// Skip if not a valid URL
		if (!this.isValidUrl(originalUrl)) {
			return { originalUrl: originalUrl ?? '', cachedUrl: originalUrl ?? '', cached: false };
		}

		// Skip if already a blob URL
		if (this.isBlobUrl(originalUrl)) {
			return { originalUrl, cachedUrl: originalUrl, cached: true };
		}

		const cacheKey = this.generateCacheKey(type, platform, identifier, originalUrl);

		// Check if already cached
		const existingUrl = await this.checkExists(cacheKey);
		if (existingUrl) {
			return { originalUrl, cachedUrl: existingUrl, cached: true };
		}

		// Download and cache
		return this.downloadAndCache(originalUrl, cacheKey, platform);
	}

	/**
	 * Cache both avatar and thumbnail for a creator
	 * Returns updated URLs (blob URLs if cached, original if failed)
	 */
	async cacheCreatorImages(
		platform: string,
		username: string,
		contentId: string,
		urls: CreatorImageUrls
	): Promise<CachedCreatorUrls> {
		const results: CachedCreatorUrls = {
			avatarUrl: urls.avatarUrl ?? null,
			thumbnailUrl: urls.thumbnailUrl ?? null,
			cacheStatus: {
				avatarCached: false,
				thumbnailCached: false,
			},
		};

		// Cache avatar
		if (this.isValidUrl(urls.avatarUrl)) {
			const avatarResult = await this.cacheImage(urls.avatarUrl, 'avatars', platform, username);
			results.avatarUrl = avatarResult.cachedUrl;
			results.cacheStatus.avatarCached = avatarResult.cached;
		}

		// Cache thumbnail
		if (this.isValidUrl(urls.thumbnailUrl)) {
			const thumbResult = await this.cacheImage(
				urls.thumbnailUrl,
				'thumbnails',
				platform,
				contentId || username
			);
			results.thumbnailUrl = thumbResult.cachedUrl;
			results.cacheStatus.thumbnailCached = thumbResult.cached;
		}

		return results;
	}

	/**
	 * Batch cache images for multiple creators with concurrency limit
	 * Fire-and-forget friendly - errors don't propagate
	 */
	async batchCacheCreators(
		creators: Array<{
			platform: string;
			username: string;
			contentId: string;
			avatarUrl?: string | null;
			thumbnailUrl?: string | null;
		}>
	): Promise<{
		processed: number;
		cached: number;
		failed: number;
	}> {
		let processed = 0;
		let cached = 0;
		let failed = 0;

		// Process in batches to limit concurrency
		for (let i = 0; i < creators.length; i += CONCURRENCY_LIMIT) {
			const batch = creators.slice(i, i + CONCURRENCY_LIMIT);

			const results = await Promise.allSettled(
				batch.map((c) =>
					this.cacheCreatorImages(c.platform, c.username, c.contentId, {
						avatarUrl: c.avatarUrl,
						thumbnailUrl: c.thumbnailUrl,
					})
				)
			);

			for (const result of results) {
				processed++;
				if (result.status === 'fulfilled') {
					const { cacheStatus } = result.value;
					if (cacheStatus.avatarCached || cacheStatus.thumbnailCached) {
						cached++;
					} else {
						failed++;
					}
				} else {
					failed++;
				}
			}
		}

		structuredConsole.log(
			`${LOG_PREFIX} Batch complete: ${processed} processed, ${cached} cached, ${failed} failed`
		);

		return { processed, cached, failed };
	}

	/**
	 * Legacy method for backwards compatibility
	 */
	async getCachedImageUrl(originalUrl: string, platform: string, userId?: string): Promise<string> {
		const result = await this.cacheImage(originalUrl, 'avatars', platform, userId || 'unknown');
		return result.cachedUrl;
	}
}

// ============================================================================
// Singleton Export
// ============================================================================

export const imageCache = new ImageCache();
