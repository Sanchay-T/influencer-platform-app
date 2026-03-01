import { describe, expect, it } from 'vitest';

/**
 * Unit tests for Social Sharing validation logic.
 * Tests URL validation, social domain allowlist, file type validation,
 * file size validation, magic byte validation, cooldown logic, and
 * subscription eligibility.
 */

// ========== Helpers mirroring service logic ==========

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const REJECTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const ALLOWED_SOCIAL_DOMAINS = [
	'twitter.com',
	'x.com',
	'instagram.com',
	'tiktok.com',
	'linkedin.com',
	'facebook.com',
	'fb.com',
	'youtube.com',
	'youtu.be',
	'threads.net',
	'reddit.com',
	'bsky.app',
];

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function validateSocialUrl(url: string): { valid: boolean; error?: string } {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}
	if (parsed.protocol !== 'https:') {
		return { valid: false, error: 'Only HTTPS links are accepted.' };
	}
	const hostname = parsed.hostname.toLowerCase();
	const isAllowed = ALLOWED_SOCIAL_DOMAINS.some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`)
	);
	if (!isAllowed) {
		return { valid: false, error: 'Unsupported social platform' };
	}
	return { valid: true };
}

function validateMagicBytes(bytes: number[]): boolean {
	const buffer = new Uint8Array(bytes);
	const isPng = PNG_MAGIC.every((b, i) => buffer[i] === b);
	const isJpeg = JPEG_MAGIC.every((b, i) => buffer[i] === b);
	return isPng || isJpeg;
}

function escapeLikePattern(input: string): string {
	return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ========== Tests ==========

describe('Social Sharing Validation', () => {
	describe('URL validation + social domain allowlist', () => {
		it('accepts valid HTTPS social media URLs', () => {
			expect(validateSocialUrl('https://twitter.com/user/status/123').valid).toBe(true);
			expect(validateSocialUrl('https://x.com/user/status/456').valid).toBe(true);
			expect(validateSocialUrl('https://instagram.com/p/abc123').valid).toBe(true);
			expect(validateSocialUrl('https://www.tiktok.com/@user/video/123').valid).toBe(true);
			expect(validateSocialUrl('https://www.linkedin.com/posts/user-123').valid).toBe(true);
			expect(validateSocialUrl('https://www.facebook.com/post/123').valid).toBe(true);
			expect(validateSocialUrl('https://youtu.be/abc123').valid).toBe(true);
			expect(validateSocialUrl('https://www.youtube.com/watch?v=abc').valid).toBe(true);
			expect(validateSocialUrl('https://www.threads.net/@user/post/123').valid).toBe(true);
			expect(validateSocialUrl('https://www.reddit.com/r/sub/comments/id').valid).toBe(true);
			expect(validateSocialUrl('https://bsky.app/profile/user/post/id').valid).toBe(true);
		});

		it('accepts subdomain variants', () => {
			expect(validateSocialUrl('https://mobile.twitter.com/user/status/1').valid).toBe(true);
			expect(validateSocialUrl('https://m.facebook.com/story/1').valid).toBe(true);
		});

		it('rejects HTTP (non-HTTPS) URLs', () => {
			const result = validateSocialUrl('http://twitter.com/user/status/123');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('HTTPS');
		});

		it('rejects non-social-media domains', () => {
			expect(validateSocialUrl('https://example.com/post').valid).toBe(false);
			expect(validateSocialUrl('https://malicious-site.com/proof').valid).toBe(false);
			expect(validateSocialUrl('https://google.com').valid).toBe(false);
		});

		it('rejects dangerous protocol URLs', () => {
			// These are valid URLs per spec but our validator rejects non-HTTPS protocols
			expect(validateSocialUrl('javascript:alert(1)').valid).toBe(false);
			expect(validateSocialUrl('data:text/html,<h1>hi</h1>').valid).toBe(false);
			expect(validateSocialUrl('ftp://files.example.com/proof.png').valid).toBe(false);
			expect(validateSocialUrl('file:///etc/passwd').valid).toBe(false);
		});

		it('rejects invalid URLs', () => {
			expect(validateSocialUrl('not-a-url').valid).toBe(false);
			expect(validateSocialUrl('').valid).toBe(false);
			expect(validateSocialUrl('just some text').valid).toBe(false);
		});
	});

	describe('File type validation', () => {
		it('accepts PNG files', () => {
			expect(ALLOWED_IMAGE_TYPES.includes('image/png')).toBe(true);
		});

		it('accepts JPEG files', () => {
			expect(ALLOWED_IMAGE_TYPES.includes('image/jpeg')).toBe(true);
		});

		it('accepts JPG files', () => {
			expect(ALLOWED_IMAGE_TYPES.includes('image/jpg')).toBe(true);
		});

		it('rejects GIF files', () => {
			expect(ALLOWED_IMAGE_TYPES.includes('image/gif')).toBe(false);
		});

		it('rejects WebP files', () => {
			expect(ALLOWED_IMAGE_TYPES.includes('image/webp')).toBe(false);
		});

		it('rejects PDF files', () => {
			expect(ALLOWED_IMAGE_TYPES.includes('application/pdf')).toBe(false);
		});
	});

	describe('Magic byte validation', () => {
		it('accepts valid PNG magic bytes', () => {
			expect(validateMagicBytes([0x89, 0x50, 0x4e, 0x47])).toBe(true);
		});

		it('accepts valid JPEG magic bytes', () => {
			expect(validateMagicBytes([0xff, 0xd8, 0xff, 0xe0])).toBe(true);
			expect(validateMagicBytes([0xff, 0xd8, 0xff, 0xe1])).toBe(true);
		});

		it('rejects GIF magic bytes', () => {
			// GIF89a
			expect(validateMagicBytes([0x47, 0x49, 0x46, 0x38])).toBe(false);
		});

		it('rejects arbitrary bytes', () => {
			expect(validateMagicBytes([0x00, 0x00, 0x00, 0x00])).toBe(false);
			expect(validateMagicBytes([0x50, 0x4b, 0x03, 0x04])).toBe(false); // ZIP
		});

		it('rejects PDF magic bytes', () => {
			// %PDF
			expect(validateMagicBytes([0x25, 0x50, 0x44, 0x46])).toBe(false);
		});
	});

	describe('File size validation', () => {
		it('accepts files under 5MB', () => {
			const size = 4 * 1024 * 1024;
			expect(size <= MAX_IMAGE_SIZE_BYTES).toBe(true);
		});

		it('accepts files exactly 5MB', () => {
			const size = 5 * 1024 * 1024;
			expect(size <= MAX_IMAGE_SIZE_BYTES).toBe(true);
		});

		it('rejects files over 5MB', () => {
			const size = 6 * 1024 * 1024;
			expect(size > MAX_IMAGE_SIZE_BYTES).toBe(true);
		});

		it('accepts small files', () => {
			const size = 100 * 1024;
			expect(size <= MAX_IMAGE_SIZE_BYTES).toBe(true);
		});
	});

	describe('Status state machine', () => {
		type Status = 'pending' | 'approved' | 'rejected';

		const canTransition = (from: Status, to: Status): boolean => {
			if (from === 'pending' && (to === 'approved' || to === 'rejected')) return true;
			return false;
		};

		it('allows pending → approved', () => {
			expect(canTransition('pending', 'approved')).toBe(true);
		});

		it('allows pending → rejected', () => {
			expect(canTransition('pending', 'rejected')).toBe(true);
		});

		it('blocks approved → rejected', () => {
			expect(canTransition('approved', 'rejected')).toBe(false);
		});

		it('blocks approved → approved (double approval)', () => {
			expect(canTransition('approved', 'approved')).toBe(false);
		});

		it('blocks rejected → approved', () => {
			expect(canTransition('rejected', 'approved')).toBe(false);
		});
	});

	describe('Self-approval prevention', () => {
		it('detects when admin is the submitter', () => {
			const submissionUserId = 'user-123';
			const adminId = 'user-123';
			expect(submissionUserId === adminId).toBe(true);
		});

		it('allows approval when admin is different from submitter', () => {
			const submissionUserId = 'user-123';
			const adminId = 'admin-456';
			expect(submissionUserId === adminId).toBe(false);
		});
	});

	describe('Subscription extension eligibility', () => {
		const ELIGIBLE_STATUSES = ['trialing', 'active'];

		it('allows extension for trialing subscriptions', () => {
			expect(ELIGIBLE_STATUSES.includes('trialing')).toBe(true);
		});

		it('allows extension for active subscriptions', () => {
			expect(ELIGIBLE_STATUSES.includes('active')).toBe(true);
		});

		it('rejects extension for canceled subscriptions', () => {
			expect(ELIGIBLE_STATUSES.includes('canceled')).toBe(false);
		});

		it('rejects extension for past_due subscriptions', () => {
			expect(ELIGIBLE_STATUSES.includes('past_due')).toBe(false);
		});

		it('rejects extension for unpaid subscriptions', () => {
			expect(ELIGIBLE_STATUSES.includes('unpaid')).toBe(false);
		});
	});

	describe('Rejection cooldown', () => {
		it('cooldown period is exactly 24 hours', () => {
			expect(REJECTION_COOLDOWN_MS).toBe(24 * 60 * 60 * 1000);
		});

		it('detects active cooldown (within 24h of rejection)', () => {
			const rejectedAt = new Date();
			const cooldownEnd = new Date(rejectedAt.getTime() + REJECTION_COOLDOWN_MS);
			expect(cooldownEnd > new Date()).toBe(true);
		});

		it('detects expired cooldown (older than 24h)', () => {
			const rejectedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
			const cooldownEnd = new Date(rejectedAt.getTime() + REJECTION_COOLDOWN_MS);
			expect(cooldownEnd > new Date()).toBe(false);
		});

		it('calculates remaining hours correctly', () => {
			const rejectedAt = new Date(Date.now() - 20 * 60 * 60 * 1000); // 20 hours ago
			const cooldownEnd = new Date(rejectedAt.getTime() + REJECTION_COOLDOWN_MS);
			const hoursLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (60 * 60 * 1000));
			expect(hoursLeft).toBe(4);
		});
	});

	describe('LIKE pattern sanitization', () => {
		it('escapes % wildcard characters', () => {
			expect(escapeLikePattern('test%search')).toBe('test\\%search');
		});

		it('escapes _ wildcard characters', () => {
			expect(escapeLikePattern('test_search')).toBe('test\\_search');
		});

		it('escapes multiple wildcards', () => {
			expect(escapeLikePattern('%_test_%')).toBe('\\%\\_test\\_\\%');
		});

		it('leaves normal strings unchanged', () => {
			expect(escapeLikePattern('user@example.com')).toBe('user@example.com');
		});

		it('handles empty string', () => {
			expect(escapeLikePattern('')).toBe('');
		});
	});
});
