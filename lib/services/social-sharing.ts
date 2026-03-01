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
 */
async function hasApprovedSubmission(userInternalId: string): Promise<boolean> {
	const result = await db
		.select({ id: socialSharingSubmissions.id })
		.from(socialSharingSubmissions)
		.where(
			and(
				eq(socialSharingSubmissions.userId, userInternalId),
				eq(socialSharingSubmissions.status, 'approved')
			)
		)
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
	// Validate URL format
	try {
		new URL(url);
	} catch {
		throw new Error('Invalid URL format');
	}

	// Lifetime limit: one free month per user
	if (await hasApprovedSubmission(userInternalId)) {
		throw new Error('You have already claimed your free month. This offer is one-time only.');
	}

	// Check for existing pending submission
	if (await hasPendingSubmission(userInternalId)) {
		throw new Error('You already have a pending submission. Please wait for it to be reviewed.');
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
	// Validate file type
	if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
		throw new Error('Invalid file type. Only PNG and JPG images are accepted.');
	}

	// Validate file size
	if (file.size > MAX_IMAGE_SIZE_BYTES) {
		throw new Error('File too large. Maximum size is 5MB.');
	}

	// Lifetime limit: one free month per user
	if (await hasApprovedSubmission(userInternalId)) {
		throw new Error('You have already claimed your free month. This offer is one-time only.');
	}

	// Check for existing pending submission
	if (await hasPendingSubmission(userInternalId)) {
		throw new Error('You already have a pending submission. Please wait for it to be reviewed.');
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
		conditions.push(ilike(users.email, `%${emailSearch}%`));
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
	const extensionResult = await extendSubscription(submission.userId);

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
	userInternalId: string
): Promise<{ extended: boolean; method: string; details: string }> {
	// Safety net: one free month per lifetime
	if (await hasApprovedSubmission(userInternalId)) {
		// This shouldn't normally fire — submitLink/submitImage check first.
		// But defend against admin calling approveSubmission on a manually
		// inserted row or an old pending row.
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
