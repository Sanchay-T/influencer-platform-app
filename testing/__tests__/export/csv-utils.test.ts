/**
 * CSV Utils Tests
 *
 * Tests for email extraction and creator deduplication used in CSV exports.
 */

import { describe, expect, it } from 'vitest';
import { dedupeByCreator, extractEmails, formatEmailsForCsv } from '@/lib/export/csv-utils';

describe('extractEmails', () => {
	it('should extract email from creator.emails array', () => {
		const creator = {
			creator: {
				username: 'testuser',
				emails: ['hello@example.com'],
			},
		};
		expect(extractEmails(creator)).toEqual(['hello@example.com']);
	});

	it('should extract email from bio_enriched.extracted_email', () => {
		const creator = {
			bio_enriched: {
				extracted_email: 'contact@creator.com',
			},
		};
		expect(extractEmails(creator)).toEqual(['contact@creator.com']);
	});

	it('should extract email from contact_email field', () => {
		const creator = {
			contact_email: 'saved@creator.com',
		};
		expect(extractEmails(creator)).toEqual(['saved@creator.com']);
	});

	it('should extract emails from metadata.enrichment.summary.allEmails', () => {
		const creator = {
			metadata: {
				enrichment: {
					summary: {
						primaryEmail: 'primary@test.com',
						allEmails: ['primary@test.com', 'secondary@test.com'],
					},
				},
			},
		};
		const result = extractEmails(creator);
		expect(result).toContain('primary@test.com');
		expect(result).toContain('secondary@test.com');
	});

	it('should NOT extract bio text that contains @ symbols', () => {
		const creator = {
			creator: {
				username: 'testuser',
				bio: 'DM me for collabs! @mybrand | fashion lover 🌟',
				emails: [],
			},
		};
		expect(extractEmails(creator)).toEqual([]);
	});

	it('should NOT recursively extract from random nested fields', () => {
		const creator = {
			creator: {
				username: 'testuser',
				bio: 'email: test@example.com',
				emails: [],
			},
			video: {
				description: 'Check out my website@stuff.com',
				statistics: { views: 1000 },
			},
		};
		// The bio contains an email-like string but it's in the bio field,
		// not in a dedicated email field — it should NOT be extracted
		expect(extractEmails(creator)).toEqual([]);
	});

	it('should deduplicate emails', () => {
		const creator = {
			email: 'same@example.com',
			creator: {
				emails: ['same@example.com'],
			},
			bio_enriched: {
				extracted_email: 'same@example.com',
			},
		};
		expect(extractEmails(creator)).toEqual(['same@example.com']);
	});

	it('should handle array input (multiple objects)', () => {
		const items = [
			{ creator: { emails: ['a@test.com'] } },
			{ email: 'b@test.com' },
		];
		const result = extractEmails(items);
		expect(result).toContain('a@test.com');
		expect(result).toContain('b@test.com');
	});

	it('should reject invalid email formats', () => {
		const creator = {
			email: 'not-an-email',
			creator: {
				emails: ['@missing-local.com', 'missing-domain@', 'spaces in@email.com'],
			},
		};
		expect(extractEmails(creator)).toEqual([]);
	});

	it('should handle null/undefined input', () => {
		expect(extractEmails(null)).toEqual([]);
		expect(extractEmails(undefined)).toEqual([]);
		expect(extractEmails({})).toEqual([]);
	});
});

describe('formatEmailsForCsv', () => {
	it('should join emails with semicolon and space', () => {
		const creator = {
			creator: { emails: ['a@test.com'] },
			bio_enriched: { extracted_email: 'b@test.com' },
		};
		expect(formatEmailsForCsv(creator)).toBe('a@test.com; b@test.com');
	});

	it('should return empty string for no emails', () => {
		expect(formatEmailsForCsv({})).toBe('');
	});
});

describe('dedupeByCreator', () => {
	it('should collapse multiple videos from the same creator into one row', () => {
		const creators = [
			{
				platform: 'TikTok',
				id: 'video1',
				mergeKey: 'johndoe',
				creator: { username: 'johndoe', uniqueId: 'johndoe', name: 'John' },
				video: { url: 'v1', statistics: { views: 100 } },
			},
			{
				platform: 'TikTok',
				id: 'video2',
				mergeKey: 'johndoe',
				creator: { username: 'johndoe', uniqueId: 'johndoe', name: 'John' },
				video: { url: 'v2', statistics: { views: 5000 } },
			},
			{
				platform: 'TikTok',
				id: 'video3',
				mergeKey: 'johndoe',
				creator: { username: 'johndoe', uniqueId: 'johndoe', name: 'John' },
				video: { url: 'v3', statistics: { views: 200 } },
			},
		];
		const result = dedupeByCreator(creators);
		expect(result).toHaveLength(1);
		// Should keep the one with the most views
		expect((result[0].video as Record<string, unknown>).url).toBe('v2');
	});

	it('should keep different creators separate', () => {
		const creators = [
			{
				platform: 'TikTok',
				mergeKey: 'user1',
				creator: { username: 'user1', uniqueId: 'user1' },
				video: { statistics: { views: 100 } },
			},
			{
				platform: 'TikTok',
				mergeKey: 'user2',
				creator: { username: 'user2', uniqueId: 'user2' },
				video: { statistics: { views: 200 } },
			},
		];
		const result = dedupeByCreator(creators);
		expect(result).toHaveLength(2);
	});

	it('should treat same username on different platforms as different creators', () => {
		const creators = [
			{
				platform: 'TikTok',
				creator: { username: 'johndoe', uniqueId: 'johndoe' },
				video: { statistics: { views: 100 } },
			},
			{
				platform: 'YouTube',
				creator: { username: 'johndoe', uniqueId: 'johndoe' },
				video: { statistics: { views: 200 } },
			},
		];
		const result = dedupeByCreator(creators);
		expect(result).toHaveLength(2);
	});

	it('should handle creators without username by keeping them all', () => {
		const creators = [
			{ platform: 'TikTok', video: { statistics: { views: 100 } } },
			{ platform: 'TikTok', video: { statistics: { views: 200 } } },
		];
		const result = dedupeByCreator(creators);
		expect(result).toHaveLength(2);
	});

	it('should be case-insensitive for username matching', () => {
		const creators = [
			{
				platform: 'TikTok',
				creator: { username: 'JohnDoe', uniqueId: 'JohnDoe' },
				video: { statistics: { views: 100 } },
			},
			{
				platform: 'TikTok',
				creator: { username: 'johndoe', uniqueId: 'johndoe' },
				video: { statistics: { views: 500 } },
			},
		];
		const result = dedupeByCreator(creators);
		expect(result).toHaveLength(1);
	});

	it('should use content.statistics as fallback for view count', () => {
		const creators = [
			{
				platform: 'TikTok',
				creator: { username: 'user1', uniqueId: 'user1' },
				content: { statistics: { views: 100 } },
			},
			{
				platform: 'TikTok',
				creator: { username: 'user1', uniqueId: 'user1' },
				content: { statistics: { views: 5000 } },
			},
		];
		const result = dedupeByCreator(creators);
		expect(result).toHaveLength(1);
		expect(
			((result[0].content as Record<string, unknown>).statistics as Record<string, unknown>).views
		).toBe(5000);
	});
});
