import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
	backgroundJobs,
	type Event,
	events,
	type NewBackgroundJob,
	type NewEvent,
} from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { toRecord } from '@/lib/utils/type-guards';

// Event types for type safety
export type EventType =
	| 'subscription_created'
	| 'subscription_updated'
	| 'subscription_deleted'
	| 'trial_started'
	| 'trial_expired'
	| 'onboarding_started'
	| 'onboarding_completed'
	| 'onboarding_step'
	| 'plan_selected'
	| 'payment_succeeded'
	| 'payment_failed'
	| 'user_created'
	| 'admin_action';

export type AggregateType = 'user' | 'subscription' | 'onboarding' | 'payment' | 'trial';

export type SourceSystem =
	| 'stripe_webhook'
	| 'admin_action'
	| 'user_action'
	| 'system_automation'
	| 'qstash_job';

export interface EventMetadata {
	requestId?: string;
	userAgent?: string;
	ipAddress?: string;
	source?: string;
	adminUserId?: string;
	[key: string]: unknown;
}

export interface EventData {
	[key: string]: unknown;
}

/**
 * Event Service - Industry Standard Event Sourcing Implementation
 *
 * Features:
 * - Idempotent event creation
 * - Event replay capability
 * - CQRS pattern support
 * - Correlation and causation tracking
 * - Automatic background job creation
 */
export class EventService {
	/**
	 * Create a new event with idempotency protection
	 */
	static async createEvent({
		aggregateId,
		aggregateType,
		eventType,
		eventData,
		metadata = {},
		sourceSystem,
		correlationId,
		causationId,
		idempotencyKey,
	}: {
		aggregateId: string;
		aggregateType: AggregateType;
		eventType: EventType;
		eventData: EventData;
		metadata?: EventMetadata;
		sourceSystem: SourceSystem;
		correlationId?: string;
		causationId?: string;
		idempotencyKey: string;
	}): Promise<Event | null> {
		structuredConsole.log('🎯 [EVENT-SERVICE] Creating event:', {
			aggregateId,
			aggregateType,
			eventType,
			sourceSystem,
			idempotencyKey,
		});

		try {
			// Check if event already exists (idempotency)
			const existingEvent = await db.query.events.findFirst({
				where: eq(events.idempotencyKey, idempotencyKey),
			});

			if (existingEvent) {
				structuredConsole.log(
					'✅ [EVENT-SERVICE] Event already exists (idempotent):',
					existingEvent.id
				);
				return existingEvent;
			}

			// Create new event
			const newEvent: NewEvent = {
				aggregateId,
				aggregateType,
				eventType,
				eventData,
				metadata: {
					...metadata,
					timestamp: new Date().toISOString(),
					version: '1.0',
				},
				sourceSystem,
				correlationId,
				causationId,
				idempotencyKey,
			};

			const [createdEvent] = await db.insert(events).values(newEvent).returning();

			structuredConsole.log('✅ [EVENT-SERVICE] Event created successfully:', {
				eventId: createdEvent.id,
				eventType,
				aggregateId,
			});

			return createdEvent;
		} catch (error) {
			structuredConsole.error('❌ [EVENT-SERVICE] Error creating event:', error);
			throw error;
		}
	}

	/**
	 * Get all events for a specific aggregate (user, subscription, etc.)
	 */
	static async getAggregateEvents(
		aggregateId: string,
		aggregateType?: AggregateType
	): Promise<Event[]> {
		const whereCondition = aggregateType
			? and(eq(events.aggregateId, aggregateId), eq(events.aggregateType, aggregateType))
			: eq(events.aggregateId, aggregateId);

		return await db.query.events.findMany({
			where: whereCondition,
			orderBy: desc(events.timestamp),
		});
	}

	/**
	 * Get events by type for debugging/analytics
	 */
	static async getEventsByType(eventType: EventType, limit: number = 100): Promise<Event[]> {
		return await db.query.events.findMany({
			where: eq(events.eventType, eventType),
			orderBy: desc(events.timestamp),
			limit,
		});
	}

	/**
	 * Mark event as processed by background job
	 */
	static async markEventProcessed(eventId: string, result?: unknown): Promise<void> {
		const metadataUpdate =
			result === undefined
				? {}
				: {
						metadata: {
							result,
						},
					};

		await db
			.update(events)
			.set({
				processingStatus: 'completed',
				processedAt: new Date(),
				...metadataUpdate,
			})
			.where(eq(events.id, eventId));

		structuredConsole.log('✅ [EVENT-SERVICE] Event marked as processed:', eventId);
	}

	/**
	 * Mark event as failed
	 */
	static async markEventFailed(
		eventId: string,
		error: string,
		retryCount: number = 0
	): Promise<void> {
		await db
			.update(events)
			.set({
				processingStatus: 'failed',
				error,
				retryCount,
			})
			.where(eq(events.id, eventId));

		structuredConsole.log('❌ [EVENT-SERVICE] Event marked as failed:', { eventId, error });
	}

	/**
	 * Create background job from event (Industry Standard)
	 */
	static async createBackgroundJob({
		jobType,
		payload,
		priority = 100,
		scheduledFor,
		maxRetries = 3,
		eventId,
	}: {
		jobType: string;
		payload: unknown;
		priority?: number;
		scheduledFor?: Date;
		maxRetries?: number;
		eventId?: string;
	}): Promise<NewBackgroundJob> {
		const job: NewBackgroundJob = {
			jobType,
			payload: {
				...(toRecord(payload) ?? { value: payload }),
				...(eventId ? { eventId } : {}),
			},
			priority,
			scheduledFor: scheduledFor || new Date(),
			maxRetries,
		};

		const [createdJob] = await db.insert(backgroundJobs).values(job).returning();

		structuredConsole.log('✅ [EVENT-SERVICE] Background job created:', {
			jobId: createdJob.id,
			jobType,
			eventId,
		});

		return createdJob;
	}

	/**
	 * Generate idempotency key for events
	 */
	static generateIdempotencyKey(source: string, identifier: string, eventType: string): string {
		return `${source}_${identifier}_${eventType}`;
	}

	/**
	 * Generate correlation ID for tracking related events
	 */
	static generateCorrelationId(): string {
		return `corr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
	}
}

// Event type constants for reuse
export const EVENT_TYPES = {
	// Subscription events
	SUBSCRIPTION_CREATED: 'subscription_created',
	SUBSCRIPTION_UPDATED: 'subscription_updated',
	SUBSCRIPTION_DELETED: 'subscription_deleted',

	// Trial events
	TRIAL_STARTED: 'trial_started',
	TRIAL_EXPIRED: 'trial_expired',

	// Onboarding events
	ONBOARDING_STARTED: 'onboarding_started',
	ONBOARDING_COMPLETED: 'onboarding_completed',

	// Payment events
	PAYMENT_SUCCEEDED: 'payment_succeeded',
	PAYMENT_FAILED: 'payment_failed',

	// User events
	USER_CREATED: 'user_created',

	// Admin events
	ADMIN_ACTION: 'admin_action',
} satisfies Record<string, EventType>;

export const AGGREGATE_TYPES = {
	USER: 'user',
	SUBSCRIPTION: 'subscription',
	ONBOARDING: 'onboarding',
	PAYMENT: 'payment',
	TRIAL: 'trial',
} satisfies Record<string, AggregateType>;

export const SOURCE_SYSTEMS = {
	STRIPE_WEBHOOK: 'stripe_webhook',
	ADMIN_ACTION: 'admin_action',
	USER_ACTION: 'user_action',
	SYSTEM_AUTOMATION: 'system_automation',
	QSTASH_JOB: 'qstash_job',
} satisfies Record<string, SourceSystem>;
