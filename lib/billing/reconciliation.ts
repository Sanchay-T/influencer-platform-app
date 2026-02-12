import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { updateUserProfile } from '@/lib/db/queries/user-queries';
import { db } from '@/lib/db';
import { userBilling, userSubscriptions, userSystemData, users } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { StripeClient } from './stripe-client';
import { handleSubscriptionChange } from './webhook-handlers';

const logger = createCategoryLogger(LogCategory.BILLING);

const ACTIVE_OR_BILLABLE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

export interface BillingReconciliationResult {
	scanned: number;
	reconciled: number;
	failed: number;
	skipped: number;
	errors: Array<{ userId: string; reason: string }>;
}

export async function reconcileStaleBillingState(options?: {
	limit?: number;
	staleMinutes?: number;
}): Promise<BillingReconciliationResult> {
	const limit = options?.limit ?? 100;
	const staleMinutes = options?.staleMinutes ?? 30;
	const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000);

	const candidates = await db
		.select({
			internalUserId: users.id,
			userId: users.userId,
			stripeSubscriptionId: userBilling.stripeSubscriptionId,
			lastWebhookTimestamp: userSystemData.lastWebhookTimestamp,
			billingSyncStatus: userSubscriptions.billingSyncStatus,
			subscriptionStatus: userSubscriptions.subscriptionStatus,
		})
		.from(users)
		.innerJoin(userBilling, eq(users.id, userBilling.userId))
		.innerJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
		.leftJoin(userSystemData, eq(users.id, userSystemData.userId))
		.where(
			and(
				isNotNull(userBilling.stripeSubscriptionId),
				inArray(userSubscriptions.subscriptionStatus, ACTIVE_OR_BILLABLE_STATUSES),
				or(
					eq(userSubscriptions.billingSyncStatus, 'pending'),
					isNull(userSystemData.lastWebhookTimestamp),
					lt(userSystemData.lastWebhookTimestamp, staleBefore)
				)
			)
		)
		.limit(limit);

	const result: BillingReconciliationResult = {
		scanned: candidates.length,
		reconciled: 0,
		failed: 0,
		skipped: 0,
		errors: [],
	};

	for (const candidate of candidates) {
		if (!candidate.stripeSubscriptionId) {
			result.skipped += 1;
			continue;
		}

		try {
			const subscription = await StripeClient.retrieveSubscription(candidate.stripeSubscriptionId, [
				'items.data.price',
			]);
			const handled = await handleSubscriptionChange(subscription, 'reconciliation');
			if (handled.success) {
				result.reconciled += 1;
				continue;
			}

			result.failed += 1;
			result.errors.push({
				userId: candidate.userId,
				reason: handled.action,
			});
			await updateUserProfile(candidate.userId, {
				billingSyncStatus: `reconcile_failed_${handled.action}`,
				lastWebhookTimestamp: new Date(),
			});
		} catch (error) {
			const normalized = error instanceof Error ? error : new Error(String(error));
			result.failed += 1;
			result.errors.push({
				userId: candidate.userId,
				reason: normalized.message,
			});
			logger.error('Billing reconciliation failed for user', normalized, {
				userId: candidate.userId,
				metadata: { stripeSubscriptionId: candidate.stripeSubscriptionId },
			});
			await updateUserProfile(candidate.userId, {
				billingSyncStatus: 'reconcile_failed_exception',
				lastWebhookTimestamp: new Date(),
			});
		}
	}

	logger.info('Billing reconciliation completed', {
		metadata: {
			scanned: result.scanned,
			reconciled: result.reconciled,
			failed: result.failed,
			skipped: result.skipped,
		},
	});

	return result;
}
