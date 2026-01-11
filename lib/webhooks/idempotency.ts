/**
 * Webhook Idempotency Helper
 *
 * Provides idempotency guarantees for webhook processing:
 * 1. Prevents duplicate processing of the same event
 * 2. Tracks processing status for observability
 * 3. Handles concurrent webhook deliveries gracefully
 *
 * Usage:
 *   const { shouldProcess } = await checkWebhookIdempotency(eventId, 'stripe', 'customer.subscription.created');
 *   if (!shouldProcess) return NextResponse.json({ received: true, duplicate: true });
 *   try {
 *     // ... process webhook ...
 *     await markWebhookCompleted(eventId);
 *   } catch (error) {
 *     await markWebhookFailed(eventId, error.message);
 *     throw error;
 *   }
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type WebhookSource, type WebhookStatus, webhookEvents } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

export interface IdempotencyCheckResult {
	shouldProcess: boolean;
	reason?: 'new' | 'already_completed' | 'already_processing' | 'retrying_failed';
	existingEvent?: {
		id: string;
		status: string;
		processedAt: Date | null;
		retryCount: number;
	};
}

/**
 * Check if a webhook event should be processed.
 *
 * Returns shouldProcess: true if:
 * - Event has never been seen before (new)
 * - Event previously failed and should be retried (retrying_failed)
 *
 * Returns shouldProcess: false if:
 * - Event was already successfully processed (already_completed)
 * - Event is currently being processed (already_processing)
 */
export async function checkWebhookIdempotency(
	eventId: string,
	source: WebhookSource,
	eventType: string,
	eventTimestamp?: Date,
	payload?: unknown
): Promise<IdempotencyCheckResult> {
	try {
		// Check if event already exists
		const existing = await db.query.webhookEvents.findFirst({
			where: eq(webhookEvents.eventId, eventId),
		});

		if (existing) {
			// Already completed - skip
			if (existing.status === 'completed') {
				logger.info('Webhook already processed (idempotent skip)', {
					metadata: {
						eventId,
						source,
						eventType,
						originalProcessedAt: existing.processedAt,
					},
				});
				return {
					shouldProcess: false,
					reason: 'already_completed',
					existingEvent: {
						id: existing.id,
						status: existing.status,
						processedAt: existing.processedAt,
						retryCount: existing.retryCount,
					},
				};
			}

			// Currently processing - skip (let first one finish)
			if (existing.status === 'processing') {
				logger.info('Webhook already processing (concurrent delivery)', {
					metadata: {
						eventId,
						source,
						eventType,
						createdAt: existing.createdAt,
					},
				});
				return {
					shouldProcess: false,
					reason: 'already_processing',
					existingEvent: {
						id: existing.id,
						status: existing.status,
						processedAt: existing.processedAt,
						retryCount: existing.retryCount,
					},
				};
			}

			// Previously failed - allow retry
			if (existing.status === 'failed') {
				logger.info('Retrying previously failed webhook', {
					metadata: {
						eventId,
						source,
						eventType,
						previousError: existing.errorMessage,
						retryCount: existing.retryCount + 1,
					},
				});

				// Update to processing
				await db
					.update(webhookEvents)
					.set({
						status: 'processing',
						retryCount: existing.retryCount + 1,
						errorMessage: null,
					})
					.where(eq(webhookEvents.eventId, eventId));

				return {
					shouldProcess: true,
					reason: 'retrying_failed',
					existingEvent: {
						id: existing.id,
						status: 'processing',
						processedAt: existing.processedAt,
						retryCount: existing.retryCount + 1,
					},
				};
			}
		}

		// New event - insert as processing
		await db
			.insert(webhookEvents)
			.values({
				eventId,
				source,
				eventType,
				status: 'processing',
				eventTimestamp,
				payload,
				metadata: {
					receivedAt: new Date().toISOString(),
				},
			})
			.onConflictDoNothing(); // Handle race condition with concurrent inserts

		logger.info('New webhook event, processing', {
			metadata: {
				eventId,
				source,
				eventType,
			},
		});

		return {
			shouldProcess: true,
			reason: 'new',
		};
	} catch (error) {
		// If we fail to check idempotency, log but allow processing
		// Better to potentially duplicate than to drop events
		logger.error(
			'Failed to check webhook idempotency, allowing processing',
			error instanceof Error ? error : new Error(String(error)),
			{
				metadata: {
					eventId,
					source,
					eventType,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
			}
		);

		return {
			shouldProcess: true,
			reason: 'new',
		};
	}
}

/**
 * Mark a webhook event as successfully completed.
 */
export async function markWebhookCompleted(eventId: string): Promise<void> {
	try {
		await db
			.update(webhookEvents)
			.set({
				status: 'completed',
				processedAt: new Date(),
			})
			.where(eq(webhookEvents.eventId, eventId));

		logger.info('Webhook processing completed', {
			metadata: { eventId },
		});
	} catch (error) {
		logger.error(
			'Failed to mark webhook as completed',
			error instanceof Error ? error : new Error(String(error)),
			{
				metadata: {
					eventId,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
			}
		);
		// Don't throw - the webhook was processed, just logging failed
	}
}

/**
 * Mark a webhook event as failed with error details.
 */
export async function markWebhookFailed(eventId: string, errorMessage: string): Promise<void> {
	try {
		await db
			.update(webhookEvents)
			.set({
				status: 'failed',
				errorMessage,
				processedAt: new Date(),
			})
			.where(eq(webhookEvents.eventId, eventId));

		logger.error('Webhook processing failed', undefined, {
			metadata: { eventId, errorMessage },
		});
	} catch (error) {
		logger.error(
			'Failed to mark webhook as failed',
			error instanceof Error ? error : new Error(String(error)),
			{
				metadata: {
					eventId,
					originalError: errorMessage,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
			}
		);
	}
}

/**
 * Check if an event timestamp is stale (older than the last processed event).
 *
 * Used to prevent out-of-order event processing from corrupting state.
 * Example: If we processed subscription.deleted at T2, we should ignore
 * subscription.updated from T1 that arrives later.
 */
export function isEventStale(
	eventTimestamp: Date | number,
	lastProcessedTimestamp: Date | null | undefined
): boolean {
	if (!lastProcessedTimestamp) {
		return false; // No previous event, not stale
	}

	const eventTime =
		typeof eventTimestamp === 'number'
			? new Date(eventTimestamp * 1000) // Stripe timestamps are Unix seconds
			: eventTimestamp;

	return eventTime < lastProcessedTimestamp;
}

/**
 * Cleanup old webhook events (for maintenance).
 * Call this periodically to prevent table bloat.
 *
 * @param olderThanDays Delete completed events older than this many days
 */
export async function cleanupOldWebhookEvents(olderThanDays: number = 30): Promise<number> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

	// Only delete completed events - keep failed for debugging
	const result = await db.execute(sql`
    DELETE FROM webhook_events
    WHERE status = 'completed'
    AND created_at < ${cutoffDate}
    RETURNING id
  `);

	const deletedCount = Array.isArray(result) ? result.length : 0;

	logger.info('Cleaned up old webhook events', {
		metadata: {
			deletedCount,
			olderThanDays,
			cutoffDate: cutoffDate.toISOString(),
		},
	});

	return deletedCount;
}
