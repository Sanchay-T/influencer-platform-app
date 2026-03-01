/**
 * Social Sharing Service
 *
 * Handles submission of social media proof, admin review, and subscription extension.
 * Users post about Gemz on social media, submit proof, and receive a free month after admin approval.
 */

import { put } from '@vercel/blob';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { createElement } from 'react';
import { SocialSharingApprovalEmail } from '@/components/email-templates/social-sharing-approval-email';
import { SocialSharingRejectionEmail } from '@/components/email-templates/social-sharing-rejection-email';
import { getPlanConfig, isValidPlan, type PlanKey } from '@/lib/billing/plan-config';
import { StripeClient } from '@/lib/billing/stripe-client';
import { db } from '@/lib/db';
import {
	type SocialSharingStatus,
	type SocialSharingSubmission,
	socialSharingSubmissions,
	userBilling,
	userSubscriptions,
	users,
} from '@/lib/db/schema';
import { sendEmail } from '@/lib/email/email-service';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.ADMIN);

/**
 * Check if a database error is a unique constraint violation (Postgres error code 23505).
 */
function isUniqueViolation(err: unknown): boolean {
	const rec = toRecord(err);
	return rec !== null && getStringProperty(rec, 'code') === '23505';
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://usegemz.io';
const REJECTION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// PNG: 89 50 4E 47, JPEG: FF D8 FF
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

/**
 * Allowed social media domains for URL submissions.
 * Matches the domain itself and any subdomain (e.g. mobile.twitter.com).
 */
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

/**
 * Validate that a URL is HTTPS and belongs to an allowed social media domain.
 */
function validateSocialUrl(url: string): void {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error('Invalid URL format');
	}
	if (parsed.protocol !== 'https:') {
		throw new Error('Only HTTPS links are accepted.');
	}
	const hostname = parsed.hostname.toLowerCase();
	const isAllowed = ALLOWED_SOCIAL_DOMAINS.some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`)
	);
	if (!isAllowed) {
		throw new Error(
			'Please submit a link from a supported social platform (Twitter/X, Instagram, TikTok, LinkedIn, Facebook, YouTube, Threads, Reddit, or Bluesky).'
		);
	}
}

/**
 * Validate file magic bytes match PNG or JPEG signatures.
 * Prevents MIME-type spoofing where the client sets image/* but the file is something else.
 */
async function validateImageMagicBytes(file: File): Promise<void> {
	const buffer = new Uint8Array(await file.slice(0, 4).arrayBuffer());
	const isPng = PNG_MAGIC.every((b, i) => buffer[i] === b);
	const isJpeg = JPEG_MAGIC.every((b, i) => buffer[i] === b);
	if (!(isPng || isJpeg)) {
		throw new Error(
			'Invalid file content. The file does not appear to be a valid PNG or JPEG image.'
		);
	}
}

/**
 * Check if the user has an active or trialing subscription.
 * Users without a subscription should not be able to submit — the reward can't be applied.
 */
async function hasEligibleSubscription(userInternalId: string): Promise<boolean> {
	const [billing] = await db
		.select({ subId: userBilling.stripeSubscriptionId })
		.from(userBilling)
		.where(eq(userBilling.userId, userInternalId))
		.limit(1);
	if (!billing?.subId) {
		return false;
	}

	const sub = await StripeClient.retrieveSubscription(billing.subId);
	return (sub.status === 'active' || sub.status === 'trialing') && !sub.cancel_at_period_end;
}

/**
 * Check if user is within the rejection cooldown window (24h after last rejection).
 * Returns the Date at which the cooldown expires, or null if no cooldown is active.
 */
async function getRejectionCooldownEnd(userInternalId: string): Promise<Date | null> {
	const [latest] = await db
		.select({
			status: socialSharingSubmissions.status,
			updatedAt: socialSharingSubmissions.updatedAt,
		})
		.from(socialSharingSubmissions)
		.where(eq(socialSharingSubmissions.userId, userInternalId))
		.orderBy(desc(socialSharingSubmissions.updatedAt))
		.limit(1);

	if (!latest || latest.status !== 'rejected') {
		return null;
	}

	const cooldownEnd = new Date(latest.updatedAt.getTime() + REJECTION_COOLDOWN_MS);
	return cooldownEnd > new Date() ? cooldownEnd : null;
}

/**
 * Escape special SQL LIKE pattern characters (%, _) in a search string.
 */
function escapeLikePattern(input: string): string {
	return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type SubmissionWithUser = {
	id: string;
	userId: string;
	evidenceType: string;
	evidenceUrl: string;
	status: string;
	adminNotes: string | null;
	approvedBy: string | null;
	approvedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	userEmail: string | null;
	userFullName: string | null;
	clerkUserId: string;
};

type SubmitLinkParams = {
	userInternalId: string;
	url: string;
};

type SubmitImageParams = {
	userInternalId: string;
	file: File;
};

type AdminReviewParams = {
	submissionId: string;
	adminInternalId: string;
};

type AdminRejectParams = AdminReviewParams & {
	reason: string;
};

type ListSubmissionsParams = {
	status?: SocialSharingStatus;
	emailSearch?: string;
	page?: number;
	pageSize?: number;
};

type SubmissionListResult = {
	submissions: SubmissionWithUser[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

// ═══════════════════════════════════════════════════════════════
// SUBMISSION QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get the latest submission for a user (most recent first).
 * Used to determine UI state (no submission, pending, approved, rejected).
 */
export async function getUserLatestSubmission(userInternalId: string) {
	const result = await db
		.select()
		.from(socialSharingSubmissions)
		.where(eq(socialSharingSubmissions.userId, userInternalId))
		.orderBy(desc(socialSharingSubmissions.createdAt))
		.limit(1);

	return result[0] ?? null;
}

/**
 * Get submission status with cooldown and eligibility metadata for the banner.
 */
export async function getSubmissionStatus(userInternalId: string) {
	const submission = await getUserLatestSubmission(userInternalId);

	if (!submission) {
		return { status: 'none' as const, submission: null, cooldownEndsAt: null, eligible: true };
	}

	// Include cooldown info for rejected submissions
	let cooldownEndsAt: string | null = null;
	if (submission.status === 'rejected') {
		const cooldownEnd = await getRejectionCooldownEnd(userInternalId);
		if (cooldownEnd) {
			cooldownEndsAt = cooldownEnd.toISOString();
		}
	}

	return {
		status: submission.status,
		submission: {
			id: submission.id,
			evidenceType: submission.evidenceType,
			evidenceUrl: submission.evidenceUrl,
			status: submission.status,
			adminNotes: submission.adminNotes,
			createdAt: submission.createdAt,
		},
		cooldownEndsAt,
		eligible: true,
	};
}

/**
 * Check if user has an active pending submission.
 */
async function hasPendingSubmission(userInternalId: string): Promise<boolean> {
	const result = await db
		.select({ id: socialSharingSubmissions.id })
		.from(socialSharingSubmissions)
		.where(
			and(
				eq(socialSharingSubmissions.userId, userInternalId),
				eq(socialSharingSubmissions.status, 'pending')
			)
		)
		.limit(1);

	return result.length > 0;
}

/**
 * Check if user already has an approved submission (lifetime limit: 1 free month).
 * Optionally exclude a specific submission ID (used by extendSubscription to
 * avoid counting the submission that was JUST approved in the same flow).
 */
async function hasApprovedSubmission(
	userInternalId: string,
	excludeSubmissionId?: string
): Promise<boolean> {
	const conditions = [
		eq(socialSharingSubmissions.userId, userInternalId),
		eq(socialSharingSubmissions.status, 'approved'),
	];
	if (excludeSubmissionId) {
		conditions.push(sql`${socialSharingSubmissions.id} != ${excludeSubmissionId}`);
	}

	const result = await db
		.select({ id: socialSharingSubmissions.id })
		.from(socialSharingSubmissions)
		.where(and(...conditions))
		.limit(1);

	return result.length > 0;
}

// ═══════════════════════════════════════════════════════════════
// USER SUBMISSION
// ═══════════════════════════════════════════════════════════════

/**
 * Submit a link as evidence of a social media post.
 */
export async function submitLink({ userInternalId, url }: SubmitLinkParams) {
	// Validate URL format + HTTPS + social media domain
	validateSocialUrl(url);

	// Lifetime limit: one free month per user
	if (await hasApprovedSubmission(userInternalId)) {
		throw new Error('You have already claimed your free month. This offer is one-time only.');
	}

	// Check for existing pending submission
	if (await hasPendingSubmission(userInternalId)) {
		throw new Error('You already have a pending submission. Please wait for it to be reviewed.');
	}

	// Enforce 24-hour cooldown after rejection
	const cooldownEnd = await getRejectionCooldownEnd(userInternalId);
	if (cooldownEnd) {
		const hoursLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (60 * 60 * 1000));
		throw new Error(
			`Please wait ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} before resubmitting. You can try again after ${cooldownEnd.toLocaleString()}.`
		);
	}

	// Must have an active or trialing subscription to claim the reward
	if (!(await hasEligibleSubscription(userInternalId))) {
		throw new Error(
			'You need an active subscription to claim a free month. Please subscribe first.'
		);
	}

	let submission: SocialSharingSubmission;
	try {
		[submission] = await db
			.insert(socialSharingSubmissions)
			.values({
				userId: userInternalId,
				evidenceType: 'link',
				evidenceUrl: url,
				status: 'pending',
			})
			.returning();
	} catch (err) {
		if (isUniqueViolation(err)) {
			throw new Error('You already have a pending submission. Please wait for it to be reviewed.');
		}
		throw err;
	}

	logger.info('Social sharing link submitted', {
		metadata: { submissionId: submission.id, userId: userInternalId },
	});

	// Notify admins asynchronously (don't block the response)
	notifyAdminsOfNewSubmission(submission.id, userInternalId).catch((err) => {
		logger.error(
			'Failed to notify admins of new submission',
			err instanceof Error ? err : new Error(String(err)),
			{
				metadata: { submissionId: submission.id },
			}
		);
	});

	return submission;
}

/**
 * Upload an image as evidence and create a submission.
 */
export async function submitImage({ userInternalId, file }: SubmitImageParams) {
	// Validate file type (MIME header)
	if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
		throw new Error('Invalid file type. Only PNG and JPG images are accepted.');
	}

	// Validate file size
	if (file.size > MAX_IMAGE_SIZE_BYTES) {
		throw new Error('File too large. Maximum size is 5MB.');
	}

	// Validate actual file content matches PNG/JPEG magic bytes
	await validateImageMagicBytes(file);

	// Lifetime limit: one free month per user
	if (await hasApprovedSubmission(userInternalId)) {
		throw new Error('You have already claimed your free month. This offer is one-time only.');
	}

	// Check for existing pending submission
	if (await hasPendingSubmission(userInternalId)) {
		throw new Error('You already have a pending submission. Please wait for it to be reviewed.');
	}

	// Enforce 24-hour cooldown after rejection
	const cooldownEnd = await getRejectionCooldownEnd(userInternalId);
	if (cooldownEnd) {
		const hoursLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (60 * 60 * 1000));
		throw new Error(
			`Please wait ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} before resubmitting. You can try again after ${cooldownEnd.toLocaleString()}.`
		);
	}

	// Must have an active or trialing subscription to claim the reward
	if (!(await hasEligibleSubscription(userInternalId))) {
		throw new Error(
			'You need an active subscription to claim a free month. Please subscribe first.'
		);
	}

	// Upload to Vercel Blob
	const filename = `social-sharing/${userInternalId}/${Date.now()}-${file.name}`;
	const blob = await put(filename, file, {
		access: 'public',
		contentType: file.type,
	});

	let submission: SocialSharingSubmission;
	try {
		[submission] = await db
			.insert(socialSharingSubmissions)
			.values({
				userId: userInternalId,
				evidenceType: 'image',
				evidenceUrl: blob.url,
				status: 'pending',
			})
			.returning();
	} catch (err) {
		if (isUniqueViolation(err)) {
			throw new Error('You already have a pending submission. Please wait for it to be reviewed.');
		}
		throw err;
	}

	logger.info('Social sharing image submitted', {
		metadata: { submissionId: submission.id, userId: userInternalId, blobUrl: blob.url },
	});

	// Notify admins asynchronously
	notifyAdminsOfNewSubmission(submission.id, userInternalId).catch((err) => {
		logger.error(
			'Failed to notify admins of new submission',
			err instanceof Error ? err : new Error(String(err)),
			{
				metadata: { submissionId: submission.id },
			}
		);
	});

	return submission;
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: LIST SUBMISSIONS
// ═══════════════════════════════════════════════════════════════

/**
 * List submissions with user info, pagination, filtering.
 */
export async function listSubmissions(
	params: ListSubmissionsParams
): Promise<SubmissionListResult> {
	const { status, emailSearch, page = 1, pageSize = 20 } = params;
	const offset = (page - 1) * pageSize;

	// Build WHERE conditions
	const conditions = [];
	if (status) {
		conditions.push(eq(socialSharingSubmissions.status, status));
	}
	if (emailSearch) {
		conditions.push(ilike(users.email, `%${escapeLikePattern(emailSearch)}%`));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get submissions with user data
	const rows = await db
		.select({
			id: socialSharingSubmissions.id,
			userId: socialSharingSubmissions.userId,
			evidenceType: socialSharingSubmissions.evidenceType,
			evidenceUrl: socialSharingSubmissions.evidenceUrl,
			status: socialSharingSubmissions.status,
			adminNotes: socialSharingSubmissions.adminNotes,
			approvedBy: socialSharingSubmissions.approvedBy,
			approvedAt: socialSharingSubmissions.approvedAt,
			createdAt: socialSharingSubmissions.createdAt,
			updatedAt: socialSharingSubmissions.updatedAt,
			userEmail: users.email,
			userFullName: users.fullName,
			clerkUserId: users.userId,
		})
		.from(socialSharingSubmissions)
		.innerJoin(users, eq(socialSharingSubmissions.userId, users.id))
		.where(whereClause)
		.orderBy(desc(socialSharingSubmissions.createdAt))
		.limit(pageSize)
		.offset(offset);

	// Get total count
	const [countResult] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(socialSharingSubmissions)
		.innerJoin(users, eq(socialSharingSubmissions.userId, users.id))
		.where(whereClause);

	const total = countResult?.count ?? 0;

	return {
		submissions: rows,
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
	};
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: APPROVE / REJECT
// ═══════════════════════════════════════════════════════════════

/**
 * Approve a submission: update status, extend subscription, send email.
 */
export async function approveSubmission({ submissionId, adminInternalId }: AdminReviewParams) {
	// 1. Load submission + verify it's pending
	const [submission] = await db
		.select()
		.from(socialSharingSubmissions)
		.where(eq(socialSharingSubmissions.id, submissionId))
		.limit(1);

	if (!submission) {
		throw new Error('Submission not found');
	}
	if (submission.status !== 'pending') {
		throw new Error(`Submission is already ${submission.status}. Cannot approve.`);
	}

	// 2. Prevent admin from approving their own submission
	if (submission.userId === adminInternalId) {
		throw new Error('You cannot approve your own submission.');
	}

	// 3. Atomic UPDATE — status='pending' in WHERE prevents double-approval race
	const [updated] = await db
		.update(socialSharingSubmissions)
		.set({
			status: 'approved',
			approvedBy: adminInternalId,
			approvedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(socialSharingSubmissions.id, submissionId),
				eq(socialSharingSubmissions.status, 'pending')
			)
		)
		.returning({ id: socialSharingSubmissions.id });

	if (!updated) {
		throw new Error('Submission was already processed by another admin.');
	}

	// 4. Extend user's subscription by 30 days
	//    Pass submissionId so the safety net excludes the just-approved submission
	const extensionResult = await extendSubscription(submission.userId, submissionId);

	// 5. Send approval email ONLY if Stripe extension actually succeeded
	if (extensionResult.extended) {
		const user = await db
			.select({ email: users.email, fullName: users.fullName })
			.from(users)
			.where(eq(users.id, submission.userId))
			.limit(1);

		if (user[0]?.email) {
			await sendEmail(
				user[0].email,
				'Your Free Month is Live!',
				createElement(SocialSharingApprovalEmail, {
					fullName: user[0].fullName ?? undefined,
					dashboardUrl: `${SITE_URL}/dashboard`,
				})
			).catch((err) => {
				logger.error(
					'Failed to send approval email',
					err instanceof Error ? err : new Error(String(err)),
					{
						metadata: { submissionId, userId: submission.userId },
					}
				);
			});
		}
	} else {
		logger.warn('Submission approved but Stripe extension failed — no email sent', {
			metadata: {
				submissionId,
				userId: submission.userId,
				extensionResult,
			},
		});
	}

	logger.info('Social sharing submission approved', {
		metadata: {
			submissionId,
			userId: submission.userId,
			adminId: adminInternalId,
			extensionResult,
		},
	});

	return { success: true, extensionResult };
}

/**
 * Reject a submission: update status, save reason, send email.
 */
export async function rejectSubmission({
	submissionId,
	adminInternalId,
	reason,
}: AdminRejectParams) {
	// 1. Load submission + verify it's pending
	const [submission] = await db
		.select()
		.from(socialSharingSubmissions)
		.where(eq(socialSharingSubmissions.id, submissionId))
		.limit(1);

	if (!submission) {
		throw new Error('Submission not found');
	}
	if (submission.status !== 'pending') {
		throw new Error(`Submission is already ${submission.status}. Cannot reject.`);
	}

	// 2. Atomic UPDATE — status='pending' in WHERE prevents double-rejection race
	const [updated] = await db
		.update(socialSharingSubmissions)
		.set({
			status: 'rejected',
			adminNotes: reason,
			approvedBy: adminInternalId,
			approvedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(socialSharingSubmissions.id, submissionId),
				eq(socialSharingSubmissions.status, 'pending')
			)
		)
		.returning({ id: socialSharingSubmissions.id });

	if (!updated) {
		throw new Error('Submission was already processed by another admin.');
	}

	// 3. Send rejection email
	const user = await db
		.select({ email: users.email, fullName: users.fullName })
		.from(users)
		.where(eq(users.id, submission.userId))
		.limit(1);

	if (user[0]?.email) {
		await sendEmail(
			user[0].email,
			'Update on Your Free Month Submission',
			createElement(SocialSharingRejectionEmail, {
				fullName: user[0].fullName ?? undefined,
				reason,
				resubmitUrl: `${SITE_URL}/dashboard`,
			})
		).catch((err) => {
			logger.error(
				'Failed to send rejection email',
				err instanceof Error ? err : new Error(String(err)),
				{
					metadata: { submissionId, userId: submission.userId },
				}
			);
		});
	}

	logger.info('Social sharing submission rejected', {
		metadata: { submissionId, userId: submission.userId, adminId: adminInternalId, reason },
	});

	return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION EXTENSION
// ═══════════════════════════════════════════════════════════════

/**
 * Extend user's subscription by one free month via Stripe API.
 *
 * - Trialing: extends trial_end by 30 days.
 * - Active: adds a credit equal to the plan's monthly price to the customer
 *   balance. The credit auto-applies to the next invoice.
 *   We avoid trial_end (regresses status to 'trialing') and pause_collection
 *   (doesn't help yearly subs with distant renewals).
 * - Canceled / past_due / other: not eligible.
 *
 * Lifetime limit: one free month per user (enforced as a safety net here,
 * primary guard is in submitLink/submitImage).
 */
async function extendSubscription(
	userInternalId: string,
	currentSubmissionId: string
): Promise<{ extended: boolean; method: string; details: string }> {
	// Safety net: one free month per lifetime.
	// Exclude currentSubmissionId — it was just marked 'approved' moments ago
	// in the same flow, so we only want to detect PRIOR approved submissions.
	if (await hasApprovedSubmission(userInternalId, currentSubmissionId)) {
		return {
			extended: false,
			method: 'already_claimed',
			details: 'User has already received their one-time free month.',
		};
	}

	// Get billing info + plan in a single query
	const [billingInfo] = await db
		.select({
			stripeSubscriptionId: userBilling.stripeSubscriptionId,
			stripeCustomerId: userBilling.stripeCustomerId,
			currentPlan: userSubscriptions.currentPlan,
		})
		.from(userBilling)
		.innerJoin(users, eq(users.id, userBilling.userId))
		.leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
		.where(eq(userBilling.userId, userInternalId))
		.limit(1);

	if (!(billingInfo?.stripeSubscriptionId && billingInfo.stripeCustomerId)) {
		logger.warn('No Stripe subscription found for social sharing extension', {
			metadata: { userId: userInternalId },
		});
		return {
			extended: false,
			method: 'none',
			details: 'No active Stripe subscription found for this user.',
		};
	}

	// Retrieve the subscription from Stripe
	const subscription = await StripeClient.retrieveSubscription(billingInfo.stripeSubscriptionId);

	// Don't extend subscriptions scheduled for cancellation
	if (subscription.cancel_at_period_end) {
		return {
			extended: false,
			method: 'canceled_pending',
			details: 'Subscription is scheduled for cancellation. No extension applied.',
		};
	}

	if (subscription.status === 'trialing') {
		// Extend trial by 30 days
		const currentTrialEnd = subscription.trial_end;
		if (!currentTrialEnd) {
			return { extended: false, method: 'trial', details: 'Trial has no end date set.' };
		}
		const newTrialEnd = currentTrialEnd + 30 * 24 * 60 * 60; // +30 days in seconds
		await StripeClient.updateSubscription(billingInfo.stripeSubscriptionId, {
			trial_end: newTrialEnd,
		});

		return {
			extended: true,
			method: 'trial_extension',
			details: `Trial extended by 30 days. New trial end: ${new Date(newTrialEnd * 1000).toISOString()}`,
		};
	}

	if (subscription.status === 'active') {
		// Determine credit amount from the user's plan monthly price
		const planCandidate = billingInfo.currentPlan ?? '';
		const planKey: PlanKey | null = isValidPlan(planCandidate) ? planCandidate : null;

		if (!planKey) {
			return {
				extended: false,
				method: 'no_plan',
				details: 'Could not determine user plan for credit calculation.',
			};
		}

		const planConfig = getPlanConfig(planKey);
		const creditAmountCents = planConfig.monthlyPrice; // e.g. 19900 for $199

		// Add credit to customer balance (negative = credit that reduces next invoice)
		await StripeClient.createCustomerBalanceTransaction(
			billingInfo.stripeCustomerId,
			-creditAmountCents,
			`Social sharing free month — ${planConfig.name} plan`,
			{ source: 'social_sharing', userId: userInternalId }
		);

		const creditDollars = (creditAmountCents / 100).toFixed(2);
		return {
			extended: true,
			method: 'billing_credit',
			details: `$${creditDollars} credit applied to customer balance (${planConfig.name} plan monthly price).`,
		};
	}

	return {
		extended: false,
		method: 'unsupported_status',
		details: `Subscription status "${subscription.status}" is not eligible for extension.`,
	};
}

// ═══════════════════════════════════════════════════════════════
// ADMIN NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Notify admins of a new submission via email and Slack webhook.
 */
async function notifyAdminsOfNewSubmission(submissionId: string, userInternalId: string) {
	// Get user info for notification
	const [user] = await db
		.select({ email: users.email, fullName: users.fullName })
		.from(users)
		.where(eq(users.id, userInternalId))
		.limit(1);

	const userName = user?.fullName || user?.email || 'Unknown user';
	const message = `New social sharing submission from ${userName}. Review at ${SITE_URL}/admin/social-sharing`;

	// Send Slack notification if webhook URL is configured
	const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
	if (slackWebhookUrl) {
		try {
			await fetch(slackWebhookUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: `🎁 ${message}`,
					blocks: [
						{
							type: 'section',
							text: {
								type: 'mrkdwn',
								text: `🎁 *New Social Sharing Submission*\n*User:* ${userName}\n*Submission ID:* ${submissionId}\n<${SITE_URL}/admin/social-sharing|Review Now>`,
							},
						},
					],
				}),
			});
		} catch (err) {
			logger.error(
				'Slack notification failed',
				err instanceof Error ? err : new Error(String(err)),
				{
					metadata: { submissionId },
				}
			);
		}
	}

	// Send email notification to admin emails
	const adminEmailsString = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS;
	if (adminEmailsString) {
		const adminEmails = adminEmailsString
			.split(',')
			.map((addr: string) => addr.trim())
			.filter(Boolean);
		for (const adminEmail of adminEmails) {
			await sendEmail(
				adminEmail,
				`New Social Sharing Submission from ${userName}`,
				createElement(
					'div',
					null,
					createElement('h2', null, 'New Social Sharing Submission'),
					createElement(
						'p',
						null,
						`${userName} has submitted proof of a social media post about Gemz.`
					),
					createElement(
						'p',
						null,
						createElement('a', { href: `${SITE_URL}/admin/social-sharing` }, 'Review Submission')
					)
				)
			).catch((err) => {
				logger.error(
					'Admin email notification failed',
					err instanceof Error ? err : new Error(String(err)),
					{
						metadata: { submissionId, adminEmail },
					}
				);
			});
		}
	}
}
