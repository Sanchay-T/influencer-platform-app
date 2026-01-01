import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createUser, getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import BillingLogger from '@/lib/loggers/billing-logger';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { UserSessionLogger } from '@/lib/logging/user-session-logger';
import {
	checkWebhookIdempotency,
	markWebhookCompleted,
	markWebhookFailed,
} from '@/lib/webhooks/idempotency';

// Clerk webhook event types
type WebhookEvent = {
	id: string;
	object: 'event';
	type: string;
	data: any;
	timestamp: number;
};

export async function POST(req: NextRequest) {
	const requestId = BillingLogger.generateRequestId();

	try {
		await BillingLogger.logAPI(
			'REQUEST_START',
			'Clerk webhook received',
			undefined,
			{
				endpoint: '/api/webhooks/clerk',
				method: 'POST',
				requestId,
			},
			requestId
		);

		// Get the headers (await for Next.js 15 compatibility)
		const headerPayload = await headers();
		const svixId = headerPayload.get('svix-id');
		const svixTimestamp = headerPayload.get('svix-timestamp');
		const svixSignature = headerPayload.get('svix-signature');

		// If there are no headers, error out
		if (!(svixId && svixTimestamp && svixSignature)) {
			await BillingLogger.logAPI(
				'REQUEST_ERROR',
				'Missing Clerk webhook headers',
				undefined,
				{
					error: 'MISSING_HEADERS',
					svixId: !!svixId,
					svixTimestamp: !!svixTimestamp,
					svixSignature: !!svixSignature,
					requestId,
				},
				requestId
			);
			return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
		}

		// Get the body
		const payload = await req.text();
		const body = JSON.parse(payload);

		// Create a new Svix instance with your webhook secret
		const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

		let evt: WebhookEvent;

		// Verify the payload with the headers
		try {
			evt = wh.verify(payload, {
				'svix-id': svixId,
				'svix-timestamp': svixTimestamp,
				'svix-signature': svixSignature,
			}) as WebhookEvent;

			await BillingLogger.logAPI(
				'REQUEST_SUCCESS',
				'Clerk webhook signature verified',
				undefined,
				{
					eventType: evt.type,
					eventId: evt.id,
					requestId,
				},
				requestId
			);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Signature verification failed';

			await BillingLogger.logAPI(
				'REQUEST_ERROR',
				'Clerk webhook signature verification failed',
				undefined,
				{
					error: errorMessage,
					requestId,
				},
				requestId
			);

			return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
		}

		const { type, data } = evt;

		// Check idempotency - prevent duplicate processing
		const { shouldProcess, reason } = await checkWebhookIdempotency(
			evt.id,
			'clerk',
			type,
			new Date(evt.timestamp),
			data
		);

		if (!shouldProcess) {
			await BillingLogger.logAPI(
				'RESPONSE',
				`Clerk webhook skipped (idempotent): ${reason}`,
				data?.id,
				{
					eventType: type,
					eventId: evt.id,
					reason,
					requestId,
				},
				requestId
			);
			return NextResponse.json({ received: true, duplicate: true, reason });
		}

		await BillingLogger.logAPI(
			'RESPONSE',
			`Processing Clerk webhook event: ${type}`,
			data?.id,
			{
				eventType: type,
				eventId: evt.id,
				userId: data?.id,
				requestId,
			},
			requestId
		);

		// Handle the webhook
		try {
			switch (type) {
				case 'user.created':
					await handleUserCreated(data, requestId);
					break;

				case 'user.updated':
					await handleUserUpdated(data, requestId);
					break;

				case 'user.deleted':
					await handleUserDeleted(data, requestId);
					break;

				default:
					await BillingLogger.logAPI(
						'RESPONSE',
						`Unhandled Clerk webhook event: ${type}`,
						data?.id,
						{
							eventType: type,
							handled: false,
							requestId,
						},
						requestId
					);
					structuredConsole.log(`🔔 [CLERK-WEBHOOK] Unhandled event type: ${type}`);
					break;
			}

			// Mark webhook as completed
			await markWebhookCompleted(evt.id);

			await BillingLogger.logAPI(
				'REQUEST_SUCCESS',
				'Clerk webhook processed successfully',
				data?.id,
				{
					eventType: type,
					eventId: evt.id,
					requestId,
				},
				requestId
			);

			return NextResponse.json({ success: true });
		} catch (processingError) {
			// Mark webhook as failed
			const errorMessage =
				processingError instanceof Error ? processingError.message : 'Unknown processing error';
			await markWebhookFailed(evt.id, errorMessage);

			await BillingLogger.logError(
				'CLERK_WEBHOOK_PROCESSING_ERROR',
				'Clerk webhook event processing failed',
				data?.id,
				{
					eventType: type,
					eventId: evt.id,
					errorMessage,
					requestId,
				},
				requestId
			);

			throw processingError; // Re-throw to outer catch
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown webhook processing error';

		await BillingLogger.logError(
			'CLERK_WEBHOOK_ERROR',
			'Clerk webhook processing failed',
			undefined,
			{
				errorMessage,
				errorType: error instanceof Error ? error.constructor.name : typeof error,
				stack: error instanceof Error ? error.stack : undefined,
				requestId,
			},
			requestId
		);

		return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
	}
}

// ========================================================================================
// WEBHOOK EVENT HANDLERS
// ========================================================================================

/**
 * Handle user creation - Create user profile with free plan
 */
async function handleUserCreated(userData: any, requestId: string) {
	const userId = userData.id;
	const email = userData.email_addresses?.[0]?.email_address;
	const firstName = userData.first_name;
	const lastName = userData.last_name;
	const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'New User';

	// Initialize user session logger for debugging
	const userLogger = email ? UserSessionLogger.forUser(email, userId) : null;
	userLogger?.log('CLERK_WEBHOOK', 'user.created webhook received', {
		userId,
		email,
		fullName,
		requestId,
	});

	await BillingLogger.logDatabase(
		'CREATE',
		'Creating new user profile after Clerk user creation',
		userId,
		{
			table: 'users',
			operation: 'user_created_webhook',
			email,
			fullName,
		},
		requestId
	);

	try {
		// Check if user profile already exists (safety check)
		const existingProfile = await getUserProfile(userId);

		if (existingProfile) {
			// User exists - but check if email needs updating (race condition fix)
			// If ensureUserProfile created the user with a fallback email, update it now
			const isPlaceholderEmail =
				existingProfile.email?.includes('@example.com') ||
				existingProfile.email?.includes('@placeholder.com');

			if (isPlaceholderEmail && email) {
				await BillingLogger.logDatabase(
					'UPDATE',
					'Updating user email from placeholder to real email',
					userId,
					{
						table: 'users',
						oldEmail: existingProfile.email,
						newEmail: email,
						reason: 'race_condition_fix',
					},
					requestId
				);

				await updateUserProfile(userId, { email, fullName });
				structuredConsole.log(
					`✅ [CLERK-WEBHOOK] Updated placeholder email to ${email} for ${userId}`
				);
			} else {
				await BillingLogger.logDatabase(
					'READ',
					'User profile already exists - skipping creation',
					userId,
					{
						table: 'users',
						existingProfile: !!existingProfile,
						currentPlan: existingProfile.currentPlan,
					},
					requestId
				);
			}
			return;
		}

		// Create new user profile with normalized tables
		// DO NOT activate trial here - trial activates AFTER payment in onboarding Step 4
		//
		// ⚠️ RACE CONDITION HANDLING:
		// Between getUserProfile() check above and createUser() below, the dashboard SSR
		// might create the user via ensureUserProfile(). We catch the duplicate key error
		// and treat it as success (user was created, just not by us).
		try {
			await createUser({
				userId: userId,
				email: email,
				fullName: fullName,
				onboardingStep: 'pending', // Will trigger onboarding modal

				// NO TRIAL DATA - trial will be activated after payment
				// trialStartDate: undefined,
				// trialEndDate: undefined,

				// currentPlan is intentionally NOT set here
				// It will be set by Stripe webhook after user completes payment
				// NULL = user hasn't completed onboarding yet
			});
		} catch (createError: any) {
			// Handle race condition: another process created the user between our check and insert
			const message = createError?.message?.toLowerCase?.() ?? '';
			const isDuplicate =
				message.includes('duplicate') ||
				message.includes('unique') ||
				createError?.code === '23505';

			if (isDuplicate) {
				await BillingLogger.logDatabase(
					'READ',
					'User profile created by concurrent process (race condition handled)',
					userId,
					{
						table: 'users',
						raceCondition: true,
						note: 'Dashboard SSR likely created the user via ensureUserProfile()',
					},
					requestId
				);
				// User exists, which is what we wanted - continue successfully
				structuredConsole.log(
					`⚡ [CLERK-WEBHOOK] Race condition handled: user ${userId} created by concurrent process`
				);
				return;
			}

			// Re-throw non-duplicate errors
			throw createError;
		}

		await BillingLogger.logDatabase(
			'CREATE',
			'User profile created successfully',
			userId,
			{
				table: 'users',
				recordId: userId,
				currentPlan: null, // NULL until Stripe confirms payment
				trialStatus: 'pending', // Trial NOT activated yet
				onboardingStep: 'pending',
				note: 'currentPlan will be set by Stripe webhook after payment',
			},
			requestId
		);

		await BillingLogger.logPlanChange(
			'UPGRADE',
			'New user created - awaiting plan selection and payment',
			userId,
			{
				fromPlan: undefined,
				toPlan: null, // No plan until payment confirmed
				reason: 'user_created',
				billingCycle: 'none', // No subscription yet
				effective: new Date().toISOString(),
			},
			requestId
		);

		structuredConsole.log(
			`✅ [CLERK-WEBHOOK] User profile created for ${userId} (trial pending payment)`
		);

		userLogger?.log('USER_CREATED', 'User profile created successfully', {
			userId,
			currentPlan: null,
			onboardingStep: 'pending',
			note: 'User must complete onboarding and payment to access product',
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Database error';

		await BillingLogger.logError(
			'USER_CREATION_ERROR',
			'Failed to create user profile',
			userId,
			{
				errorMessage,
				errorType: error instanceof Error ? error.constructor.name : typeof error,
				email,
				fullName,
			},
			requestId
		);

		structuredConsole.error(`❌ [CLERK-WEBHOOK] Error creating user profile for ${userId}:`, error);
		throw error;
	}
}

/**
 * Handle user updates - Update email, name, etc.
 */
async function handleUserUpdated(userData: any, requestId: string) {
	const userId = userData.id;
	const email = userData.email_addresses?.[0]?.email_address;
	const firstName = userData.first_name;
	const lastName = userData.last_name;
	const fullName = `${firstName || ''} ${lastName || ''}`.trim();

	try {
		await BillingLogger.logDatabase(
			'UPDATE',
			'Updating user profile after Clerk user update',
			userId,
			{
				table: 'users',
				operation: 'user_updated_webhook',
				email,
				fullName,
			},
			requestId
		);

		// Update user profile
		const updateData: any = {};

		if (email) updateData.email = email;
		if (fullName) updateData.fullName = fullName;

		await updateUserProfile(userId, updateData);

		await BillingLogger.logDatabase(
			'UPDATE',
			'User profile updated successfully',
			userId,
			{
				table: 'users',
				changes: Object.keys(updateData),
				email,
				fullName,
			},
			requestId
		);

		structuredConsole.log(`✅ [CLERK-WEBHOOK] User profile updated for ${userId}`);
	} catch (error) {
		await BillingLogger.logError(
			'USER_UPDATE_ERROR',
			'Failed to update user profile',
			userId,
			{
				errorMessage: error instanceof Error ? error.message : 'Database error',
				email,
				fullName,
			},
			requestId
		);

		structuredConsole.error(`❌ [CLERK-WEBHOOK] Error updating user profile for ${userId}:`, error);
		throw error;
	}
}

/**
 * Handle user deletion - Clean up user data
 */
async function handleUserDeleted(userData: any, requestId: string) {
	const userId = userData.id;

	try {
		await BillingLogger.logDatabase(
			'DELETE',
			'Deleting user profile after Clerk user deletion',
			userId,
			{
				table: 'users',
				operation: 'user_deleted_webhook',
			},
			requestId
		);

		// For user deletion, we need to use the raw database operations as we don't have a delete function
		// This is intentionally limited since user deletion should be rare
		const { db } = await import('@/lib/db');
		const { users } = await import('@/lib/db/schema');
		const { eq } = await import('drizzle-orm');

		// Delete user (cascade will handle related tables)
		await db.delete(users).where(eq(users.userId, userId));

		await BillingLogger.logDatabase(
			'DELETE',
			'User profile deleted successfully',
			userId,
			{
				table: 'users',
				recordId: userId,
			},
			requestId
		);

		await BillingLogger.logPlanChange(
			'CANCEL',
			'User account deleted - profile removed',
			userId,
			{
				reason: 'user_deleted',
			},
			requestId
		);

		structuredConsole.log(`✅ [CLERK-WEBHOOK] User profile deleted for ${userId}`);
	} catch (error) {
		await BillingLogger.logError(
			'USER_DELETE_ERROR',
			'Failed to delete user profile',
			userId,
			{
				errorMessage: error instanceof Error ? error.message : 'Database error',
			},
			requestId
		);

		structuredConsole.error(`❌ [CLERK-WEBHOOK] Error deleting user profile for ${userId}:`, error);
		throw error;
	}
}
