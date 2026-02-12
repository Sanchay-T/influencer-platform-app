import { describe, expect, it } from 'vitest';
import { validateDispatchRequest } from '@/lib/search-engine/v2/workers/validation';

describe('validateDispatchRequest', () => {
	it('accepts keyword dispatch payloads', () => {
		const result = validateDispatchRequest({
			platform: 'instagram',
			keywords: ['fitness creators'],
			targetResults: 100,
			campaignId: '123e4567-e89b-12d3-a456-426614174000',
		});

		expect(result.valid).toBe(true);
		if (!result.valid) {
			throw new Error('Expected valid result');
		}
		expect(result.data.searchType).toBe('keyword');
		expect(result.data.keywords).toEqual(['fitness creators']);
	});

	it('requires seedUsername for similar dispatch payloads', () => {
		const result = validateDispatchRequest({
			searchType: 'similar',
			platform: 'instagram',
			campaignId: '123e4567-e89b-12d3-a456-426614174000',
		});

		expect(result.valid).toBe(false);
		if (result.valid) {
			throw new Error('Expected invalid result');
		}
		expect(result.error).toContain('seedUsername');
	});

	it('accepts similar payloads with supported engines', () => {
		const result = validateDispatchRequest({
			searchType: 'similar',
			platform: 'youtube',
			seedUsername: 'mkbhd',
			campaignId: '123e4567-e89b-12d3-a456-426614174000',
			targetResults: 500,
			similarEngine: 'youtube_similar',
		});

		expect(result.valid).toBe(true);
		if (!result.valid) {
			throw new Error('Expected valid result');
		}
		expect(result.data.searchType).toBe('similar');
		expect(result.data.seedUsername).toBe('mkbhd');
		expect(result.data.similarEngine).toBe('youtube_similar');
	});
});
