/**
 * Media and image handling utilities.
 * Extracted from search-results.jsx for modularity.
 */

import { resolveCreatorPreview } from '@/lib/utils/media-preview';
import type { CreatorSnapshot } from './creator-snapshot';
import type { Creator } from './creator-utils';

/**
 * Ensures a URL is properly formatted for image display.
 * Handles proxying external URLs through our image proxy endpoint.
 */
export const ensureImageUrl = (value: string | null | undefined): string => {
	if (typeof value !== 'string') {
		return '';
	}
	const url = value.trim();
	if (!url) {
		return '';
	}

	// Already proxied or special URL formats
	if (
		url.startsWith('/api/proxy/image') ||
		url.startsWith('data:') ||
		url.startsWith('blob:') ||
		url.includes('blob.vercel-storage.com')
	) {
		return url;
	}

	// Handle protocol-relative URLs
	const normalized = url.startsWith('//') ? `https:${url}` : url;

	// Proxy external URLs
	if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
		return `/api/proxy/image?url=${encodeURIComponent(normalized)}`;
	}

	return normalized;
};

/**
 * Resolves a creator's preview image using the shared preview resolver.
 * Keyword search gallery defers to shared preview resolver to keep TikTok/IG covers consistent.
 */
export const resolveMediaPreview = (
	creator: Creator | null | undefined,
	snapshot: CreatorSnapshot | null | undefined,
	_platformHint?: string
): string | null => resolveCreatorPreview(creator, snapshot?.avatarUrl ?? null);

/**
 * Image load event handler - used for debugging image loading.
 */
export const handleImageLoad = (
	_e: React.SyntheticEvent<HTMLImageElement>,
	_creatorName?: string
): void => {
	// Debug logging disabled in production
	// console.log(`Image loaded for ${creatorName}:`, e.currentTarget.src);
};

/**
 * Image error event handler - used for debugging failed image loads.
 */
export const handleImageError = (
	_e: React.SyntheticEvent<HTMLImageElement>,
	_creatorName?: string,
	_originalUrl?: string
): void => {
	// Debug logging disabled in production
	// console.error(`Image failed for ${creatorName}:`, originalUrl);
};

/**
 * Image load start event handler - used for debugging image loading.
 */
export const handleImageStart = (
	_e: React.SyntheticEvent<HTMLImageElement>,
	_creatorName?: string
): void => {
	// Debug logging disabled in production
	// console.log(`Image started loading for ${creatorName}`);
};
