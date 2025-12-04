import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import {
	ensureUserProfile,
	getUserByStripeCustomerId,
	getUserProfile,
	updateUserProfile,
} from '@/lib/db/queries/user-queries';
import { subscriptionPlans } from '@/lib/db/schema';
import {
	AGGREGATE_TYPES,
	EVENT_TYPES,
	EventService,
	SOURCE_SYSTEMS,
} from '@/lib/events/event-service';
import { JobProcessor } from '@/lib/jobs/job-processor';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { UserSessionLogger } from '@/lib/logging/user-session-logger';
import { finalizeOnboarding } from '@/lib/onboarding/finalize-onboarding';
import { StripeService } from '@/lib/stripe/stripe-service';
import {
	checkWebhookIdempotency,
	markWebhookCompleted,
	markWebhookFailed,
} from '@/lib/webhooks/idempotency';

export async function POST(req: NextRequest) {
	// Step 1: Parse request and validate signature
	// Signature errors are CLIENT errors (400), not server errors (500)
	// This is important because Stripe retries on 5xx but not on 4xx
	let event: Stripe.Event;

	try {
		const body = await req.text();
		const signature = req.headers.get('stripe-signature');

		if (!signature) {
			return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
		}

		// Validate webhook signature - throws if invalid
		event = StripeService.validateWebhookSignature(body, signature);
	} catch (signatureError) {
		// Signature validation failed - this is a CLIENT error (400)
		// Do NOT return 500 here or Stripe will keep retrying forever
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Signature validation failed:', signatureError);
		return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
	}

	// Step 2: Process the validated event
	// Processing errors ARE server errors (500) so Stripe will retry
	try {
		structuredConsole.log('📥 [STRIPE-WEBHOOK] Received event:', event.type);

		// Check idempotency - prevent duplicate processing
		const { shouldProcess, reason } = await checkWebhookIdempotency(
			event.id,
			'stripe',
			event.type,
			new Date(event.created * 1000),
			event.data.object
		);

		if (!shouldProcess) {
			structuredConsole.log('⏭️ [STRIPE-WEBHOOK] Skipping duplicate event:', {
				eventId: event.id,
				eventType: event.type,
				reason,
			});
			return NextResponse.json({ received: true, duplicate: true, reason });
		}

		// Process webhook events with idempotency tracking
		try {
			switch (event.type) {
				case 'checkout.session.completed':
					await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
					break;

				case 'customer.subscription.created':
					await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
					break;

				case 'customer.subscription.updated':
					await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
					break;

				case 'customer.subscription.deleted':
					await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
					break;

				case 'customer.subscription.trial_will_end':
					await handleTrialWillEnd(event.data.object as Stripe.Subscription);
					break;

				case 'invoice.payment_succeeded':
					await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
					break;

				case 'invoice.payment_failed':
					await handlePaymentFailed(event.data.object as Stripe.Invoice);
					break;

				case 'setup_intent.succeeded':
					await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
					break;

				case 'payment_method.attached':
					await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
					break;

				default:
					structuredConsole.log('⚠️ [STRIPE-WEBHOOK] Unhandled event type:', event.type);
			}

			// Mark webhook as completed
			await markWebhookCompleted(event.id);

			return NextResponse.json({ received: true });
		} catch (processingError) {
			// Mark webhook as failed
			const errorMessage =
				processingError instanceof Error ? processingError.message : 'Unknown processing error';
			await markWebhookFailed(event.id, errorMessage);

			structuredConsole.error('❌ [STRIPE-WEBHOOK] Processing failed:', {
				eventId: event.id,
				eventType: event.type,
				error: errorMessage,
			});

			throw processingError; // Re-throw to outer catch
		}
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error:', error);
		return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
	}
}

// Helper function to determine plan from price ID
function getPlanFromPriceId(priceId: string): string {
	const priceIdToplan = {
		[process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID!]: 'glow_up',
		[process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID!]: 'glow_up',
		[process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID!]: 'viral_surge',
		[process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID!]: 'viral_surge',
		[process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID!]: 'fame_flex',
		[process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID!]: 'fame_flex',
	};

	const plan = priceIdToplan[priceId];

	if (plan) {
		structuredConsole.log('✅ [STRIPE-WEBHOOK] Plan mapped successfully:', { priceId, plan });
	} else {
		structuredConsole.error('⚠️ [STRIPE-WEBHOOK] Unknown price ID encountered:', {
			priceId,
			availableMappings: Object.keys(priceIdToplan).filter((key) => key !== 'undefined'),
			allEnvVars: Object.entries(priceIdToplan).map(([key, value]) => ({
				priceId: key,
				plan: value,
			})),
		});
	}

	return plan || 'unknown';
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
	const requestId = `webhook_checkout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const userId = session.metadata?.userId;

	structuredConsole.log('🧾 [STRIPE-WEBHOOK] checkout.session.completed received', {
		requestId,
		sessionId: session.id,
		userId,
		paymentStatus: session.payment_status,
		mode: session.mode,
		customer: session.customer,
	});

	if (!userId) {
		structuredConsole.warn(
			'⚠️ [STRIPE-WEBHOOK] Checkout session missing userId metadata; skipping onboarding finalization.',
			{
				requestId,
				sessionId: session.id,
			}
		);
		return;
	}

	// Initialize user session logger
	const emailHint = session.customer_details?.email || session.metadata?.email;
	const userLogger = emailHint ? UserSessionLogger.forUser(emailHint, userId) : null;

	userLogger?.log('STRIPE_WEBHOOK', 'checkout.session.completed received', {
		sessionId: session.id,
		paymentStatus: session.payment_status,
		amountTotal: session.amount_total,
		currency: session.currency,
	});

	// Use ensureUserProfile instead of getUserProfile to handle race condition:
	// Stripe webhook can arrive BEFORE Clerk webhook creates the user.
	// ensureUserProfile will create the user if they don't exist yet.
	let userProfile;
	try {
		userProfile = await ensureUserProfile(userId);
		structuredConsole.log('✅ [STRIPE-WEBHOOK] User profile ensured (created or fetched)', {
			requestId,
			userId,
			sessionId: session.id,
			onboardingStep: userProfile.onboardingStep,
		});

		userLogger?.log('USER_ENSURED', 'User profile ensured for checkout', {
			wasCreated: userProfile.onboardingStep === 'pending',
			currentPlan: userProfile.currentPlan,
			onboardingStep: userProfile.onboardingStep,
		});
	} catch (error) {
		userLogger?.log('ERROR', 'Failed to ensure user profile', {
			error: error instanceof Error ? error.message : 'Unknown error',
		});

		structuredConsole.error(
			'❌ [STRIPE-WEBHOOK] Failed to ensure user profile - cannot proceed with checkout',
			{
				requestId,
				userId,
				sessionId: session.id,
				error,
			}
		);
		throw error; // Re-throw to trigger webhook retry
	}

	if (userProfile.onboardingStep === 'completed') {
		structuredConsole.log(
			'✅ [STRIPE-WEBHOOK] Onboarding already completed, skipping finalizeOnboarding',
			{
				requestId,
				userId,
			}
		);
		return;
	}

	try {
		const emailHint = session.customer_details?.email || session.metadata?.email || null;
		const result = await finalizeOnboarding(userId, {
			requestId,
			clerkEmailHint: emailHint,
			triggerEmails: true,
			skipIfCompleted: true,
		});

		structuredConsole.log('✅ [STRIPE-WEBHOOK] finalizeOnboarding executed from checkout session', {
			requestId,
			userId,
			sessionId: session.id,
			alreadyCompleted: result.alreadyCompleted,
			trialStatus: result.trial?.trialStatus,
			emailScheduled: result.emails?.success ?? false,
		});

		userLogger?.log('ONBOARDING_COMPLETE', 'User onboarding finalized successfully', {
			alreadyCompleted: result.alreadyCompleted,
			trialStatus: result.trial?.trialStatus,
			trialEndDate: result.trial?.trialEndDate,
			emailScheduled: result.emails?.success ?? false,
		});

		userLogger?.log('PAYMENT_SUCCESS', '🎉 User is now fully onboarded and can use the product!', {
			plan: session.metadata?.plan || 'unknown',
			paymentStatus: session.payment_status,
		});
	} catch (error) {
		structuredConsole.error(
			'❌ [STRIPE-WEBHOOK] finalizeOnboarding failed during checkout session handling',
			{
				requestId,
				userId,
				sessionId: session.id,
				error,
			}
		);
		throw error;
	}
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
	try {
		const webhookTestId = `WEBHOOK_SUBSCRIPTION_CREATED_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		structuredConsole.log(
			`🎯 [WEBHOOK-TEST] ${webhookTestId} - Processing subscription.created webhook`
		);

		const customerId = subscription.customer as string;
		structuredConsole.log(`🔍 [WEBHOOK-TEST] ${webhookTestId} - Subscription details:`, {
			subscriptionId: subscription.id,
			customerId,
			status: subscription.status,
			metadata: subscription.metadata,
			priceId: subscription.items.data[0]?.price?.id,
		});

		// Try multiple ways to get the plan ID
		let planId = subscription.metadata.plan || subscription.metadata.planId;

		// If metadata doesn't have plan info, determine from price ID
		if (!planId || planId === 'unknown') {
			const priceId = subscription.items.data[0]?.price?.id;
			if (priceId) {
				planId = getPlanFromPriceId(priceId);
				structuredConsole.log('🔍 [STRIPE-WEBHOOK] Plan determined from price ID:', {
					priceId,
					planId,
				});
			}
		}

		// 🚨 CRITICAL: Never use arbitrary fallback plan - this causes upgrade bugs
		if (!planId || planId === 'unknown') {
			structuredConsole.error(
				'❌ [STRIPE-WEBHOOK] CRITICAL: Cannot determine plan from subscription',
				{
					subscriptionId: subscription.id,
					customerId,
					metadata: subscription.metadata,
					priceId: subscription.items.data[0]?.price?.id,
					availableEnvVars: {
						glow_up_monthly: !!process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID,
						glow_up_yearly: !!process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID,
						viral_surge_monthly: !!process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID,
						viral_surge_yearly: !!process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID,
						fame_flex_monthly: !!process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID,
						fame_flex_yearly: !!process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID,
					},
				}
			);
			throw new Error(
				`Cannot determine plan for subscription ${subscription.id}. This webhook will be retried.`
			);
		}

		structuredConsole.log('🎯 [STRIPE-WEBHOOK] Processing subscription created (Event-Driven):', {
			subscriptionId: subscription.id,
			customerId,
			planId,
			status: subscription.status,
			trialEnd: subscription.trial_end,
			timestamp: new Date().toISOString(),
		});

		// 🔍 DIAGNOSTIC LOGS - Check if event sourcing system is available
		try {
			structuredConsole.log(
				'🔍 [STRIPE-WEBHOOK-DIAGNOSTICS] Checking event sourcing system availability...'
			);
			const { EventService, EVENT_TYPES } = await import('@/lib/events/event-service');
			structuredConsole.log(
				'✅ [STRIPE-WEBHOOK-DIAGNOSTICS] Event sourcing system imported successfully'
			);
		} catch (importError) {
			structuredConsole.error(
				'❌ [STRIPE-WEBHOOK-DIAGNOSTICS] Event sourcing system import failed:',
				importError
			);
			structuredConsole.error(
				'🚨 [STRIPE-WEBHOOK-DIAGNOSTICS] CRITICAL: Event sourcing not available - falling back to direct DB update'
			);
		}

		// Find user by Stripe customer ID (using normalized tables)
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		structuredConsole.log('✅ [STRIPE-WEBHOOK] User found:', user.userId);

		// Generate correlation ID for tracking related events
		const correlationId = EventService.generateCorrelationId();

		// Create event for audit trail (Industry Standard)
		const subscriptionEvent = await EventService.createEvent({
			aggregateId: user.userId,
			aggregateType: AGGREGATE_TYPES.SUBSCRIPTION,
			eventType: EVENT_TYPES.SUBSCRIPTION_CREATED,
			eventData: {
				subscriptionId: subscription.id,
				customerId,
				planId,
				status: subscription.status,
				trialEnd: subscription.trial_end,
				metadata: subscription.metadata,
				stripeRaw: subscription,
			},
			metadata: {
				stripeEventId: subscription.id,
				webhookSource: 'stripe',
				requestId: `stripe_webhook_${Date.now()}`,
			},
			sourceSystem: SOURCE_SYSTEMS.STRIPE_WEBHOOK,
			correlationId,
			idempotencyKey: EventService.generateIdempotencyKey(
				'stripe',
				subscription.id,
				'subscription_created'
			),
		});

		// 🔧 FIX: Get plan limits from subscription_plans table
		const planDetails = await db.query.subscriptionPlans.findFirst({
			where: eq(subscriptionPlans.planKey, planId),
		});

		if (!planDetails) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] Plan details not found for:', planId);
			// Continue with basic update, but log the issue
		}

		// Update subscription info immediately using normalized tables
		structuredConsole.log(
			`🔄 [WEBHOOK-TEST] ${webhookTestId} - Updating user profile with plan: ${planId}`
		);
		const updateData = {
			stripeSubscriptionId: subscription.id,
			currentPlan: planId,
			subscriptionStatus: subscription.status,
			// 🚀 CRITICAL FIX: Set plan limits from subscription_plans table
			planCampaignsLimit: planDetails?.campaignsLimit || 0,
			planCreatorsLimit: planDetails?.creatorsLimit || 0,
			planFeatures: planDetails?.features || {},
			billingSyncStatus: 'webhook_subscription_created',
			lastWebhookEvent: 'customer.subscription.created',
			lastWebhookTimestamp: new Date(),
		};

		structuredConsole.log(
			`🔍 [WEBHOOK-TEST] ${webhookTestId} - Update data being applied:`,
			updateData
		);
		await updateUserProfile(user.userId, updateData);
		structuredConsole.log(`✅ [WEBHOOK-TEST] ${webhookTestId} - User profile updated successfully`);

		structuredConsole.log('✅ [STRIPE-WEBHOOK] User plan limits updated:', {
			planId,
			campaignsLimit: planDetails?.campaignsLimit,
			creatorsLimit: planDetails?.creatorsLimit,
		});

		// If subscription has trial, queue background job to complete onboarding (Industry Standard)
		if (subscription.trial_end && subscription.status === 'trialing') {
			structuredConsole.log('🚀 [STRIPE-WEBHOOK] Queueing background job to complete onboarding');

			try {
				// 🔍 DIAGNOSTIC LOGS - Check JobProcessor availability
				structuredConsole.log('🔍 [STRIPE-WEBHOOK-DIAGNOSTICS] Importing JobProcessor...');
				const { JobProcessor } = await import('@/lib/jobs/job-processor');
				structuredConsole.log('✅ [STRIPE-WEBHOOK-DIAGNOSTICS] JobProcessor imported successfully');

				const jobId = await JobProcessor.queueJob({
					jobType: 'complete_onboarding',
					payload: {
						userId: user.userId,
						stripeSubscriptionId: subscription.id,
						stripeCustomerId: customerId,
						planId,
						trialEndTimestamp: subscription.trial_end,
						eventId: subscriptionEvent?.id,
						correlationId,
					},
					delay: 2000, // 2 second delay to ensure webhook completes first
					priority: 10, // High priority
				});

				structuredConsole.log('✅ [STRIPE-WEBHOOK] Background job queued successfully:', {
					jobId,
					jobType: 'complete_onboarding',
					userId: user.userId,
					queuedAt: new Date().toISOString(),
				});

				// 🔍 DIAGNOSTIC LOGS - Verify job was created in database
				structuredConsole.log(
					'🔍 [STRIPE-WEBHOOK-DIAGNOSTICS] Verifying job creation in database...'
				);
			} catch (jobError) {
				structuredConsole.error('❌ [STRIPE-WEBHOOK-DIAGNOSTICS] JobProcessor failed:', jobError);
				structuredConsole.error(
					'🚨 [STRIPE-WEBHOOK-DIAGNOSTICS] CRITICAL: Background job not queued - onboarding will not complete automatically'
				);

				// FALLBACK: Direct onboarding completion (temporary emergency fix)
				structuredConsole.log(
					'🔧 [STRIPE-WEBHOOK-DIAGNOSTICS] EMERGENCY FALLBACK: Completing onboarding directly'
				);
				const trialStartDate = new Date();
				const trialEndDate = new Date(subscription.trial_end * 1000);

				await updateUserProfile(user.userId, {
					onboardingStep: 'completed',
					trialStatus: 'active',
					trialStartDate,
					trialEndDate,
					billingSyncStatus: 'webhook_emergency_fallback',
				});

				structuredConsole.log(
					'🔧 [STRIPE-WEBHOOK-DIAGNOSTICS] Emergency fallback completed - onboarding set to completed'
				);
			}
		}

		structuredConsole.log(
			'✅ [STRIPE-WEBHOOK] Subscription created event processed (Event-Driven):',
			{
				userId: user.userId,
				eventId: subscriptionEvent?.id,
				hasTrialJob: !!(subscription.trial_end && subscription.status === 'trialing'),
			}
		);
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling subscription created:', error);
		throw error;
	}
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
	try {
		const customerId = subscription.customer as string;

		// Try multiple ways to get the plan ID
		let planId = subscription.metadata.plan || subscription.metadata.planId;

		// If metadata doesn't have plan info, determine from price ID
		if (!planId || planId === 'unknown') {
			const priceId = subscription.items.data[0]?.price?.id;
			if (priceId) {
				planId = getPlanFromPriceId(priceId);
				structuredConsole.log('🔍 [STRIPE-WEBHOOK] Plan determined from price ID for update:', {
					priceId,
					planId,
				});
			}
		}

		// 🚨 CRITICAL: Never proceed with unknown plan - this causes upgrade bugs
		if (!planId || planId === 'unknown') {
			structuredConsole.error(
				'❌ [STRIPE-WEBHOOK] CRITICAL: Cannot determine plan for subscription update',
				{
					subscriptionId: subscription.id,
					customerId,
					metadata: subscription.metadata,
					priceId: subscription.items.data[0]?.price?.id,
				}
			);
			throw new Error(
				`Cannot determine plan for subscription update ${subscription.id}. This webhook will be retried.`
			);
		}

		// Find user by Stripe customer ID
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		const updateData: any = {
			currentPlan: planId,
			subscriptionStatus: subscription.status,
			billingSyncStatus: 'webhook_subscription_updated',
			lastWebhookEvent: 'customer.subscription.updated',
			lastWebhookTimestamp: new Date(),
			updatedAt: new Date(),
		};

		// Handle trial conversion - more comprehensive logic
		if (subscription.status === 'active' && user.trialStatus === 'active') {
			structuredConsole.log('🎯 [STRIPE-WEBHOOK] Trial converted to paid subscription');
			updateData.trialStatus = 'converted';
			updateData.trialConversionDate = new Date();
		}

		// Handle explicit trial end
		if (subscription.trial_end && subscription.trial_end * 1000 < Date.now()) {
			updateData.trialStatus = 'converted';
			updateData.trialConversionDate = new Date();
		}

		// Set plan limits from database (not hardcoded)
		const planDetails = await db.query.subscriptionPlans.findFirst({
			where: eq(subscriptionPlans.planKey, planId),
		});
		if (planDetails) {
			updateData.planCampaignsLimit = planDetails.campaignsLimit;
			updateData.planCreatorsLimit = planDetails.creatorsLimit;
		}

		// Handle cancellation
		if (subscription.cancel_at_period_end) {
			updateData.subscriptionCancelDate = new Date(subscription.current_period_end * 1000);
		}

		await updateUserProfile(user.userId, updateData);

		structuredConsole.log('✅ [STRIPE-WEBHOOK] Subscription updated for user:', user.userId);
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling subscription updated:', error);
		throw error;
	}
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
	try {
		const customerId = subscription.customer as string;

		// Find user by Stripe customer ID using normalized tables
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		// Update user profile using normalized tables
		await updateUserProfile(user.userId, {
			currentPlan: 'free',
			subscriptionStatus: 'canceled',
			billingSyncStatus: 'webhook_subscription_deleted',
			subscriptionCancelDate: new Date(),
			lastWebhookEvent: 'customer.subscription.deleted',
			lastWebhookTimestamp: new Date(),
			// Reset plan limits to free tier
			planCampaignsLimit: 0,
			planCreatorsLimit: 0,
			planFeatures: {},
		});

		structuredConsole.log('✅ [STRIPE-WEBHOOK] Subscription deleted for user:', user.userId);
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling subscription deleted:', error);
		throw error;
	}
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
	try {
		const customerId = subscription.customer as string;

		// Find user by Stripe customer ID using normalized tables
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		// Update user profile using normalized tables
		await updateUserProfile(user.userId, {
			billingSyncStatus: 'webhook_trial_will_end',
			lastWebhookEvent: 'customer.subscription.trial_will_end',
			lastWebhookTimestamp: new Date(),
		});

		structuredConsole.log('✅ [STRIPE-WEBHOOK] Trial will end for user:', user.userId);

		// Here you could send a reminder email or trigger other actions
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling trial will end:', error);
		throw error;
	}
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
	try {
		const customerId = invoice.customer as string;

		// Find user by Stripe customer ID using normalized tables
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		// Update user profile using normalized tables
		await updateUserProfile(user.userId, {
			billingSyncStatus: 'webhook_payment_succeeded',
			lastWebhookEvent: 'invoice.payment_succeeded',
			lastWebhookTimestamp: new Date(),
		});

		structuredConsole.log('✅ [STRIPE-WEBHOOK] Payment succeeded for user:', user.userId);
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling payment succeeded:', error);
		throw error;
	}
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
	try {
		const customerId = invoice.customer as string;

		// Find user by Stripe customer ID using normalized tables
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		// Update user profile using normalized tables
		await updateUserProfile(user.userId, {
			billingSyncStatus: 'webhook_payment_failed',
			lastWebhookEvent: 'invoice.payment_failed',
			lastWebhookTimestamp: new Date(),
		});

		structuredConsole.log('✅ [STRIPE-WEBHOOK] Payment failed for user:', user.userId);

		// Here you could send a payment failure notification or retry logic
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling payment failed:', error);
		throw error;
	}
}

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
	try {
		const customerId = setupIntent.customer as string;

		// Find user by Stripe customer ID using normalized tables
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		// Update user profile using normalized tables
		await updateUserProfile(user.userId, {
			billingSyncStatus: 'webhook_setup_intent_succeeded',
			lastWebhookEvent: 'setup_intent.succeeded',
			lastWebhookTimestamp: new Date(),
		});

		structuredConsole.log('✅ [STRIPE-WEBHOOK] Setup intent succeeded for user:', user.userId);
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling setup intent succeeded:', error);
		throw error;
	}
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
	try {
		const customerId = paymentMethod.customer as string;

		// Find user by Stripe customer ID using normalized tables
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			structuredConsole.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
			return;
		}

		// Update user profile with payment method details using normalized tables
		const updateData: any = {
			paymentMethodId: paymentMethod.id,
			billingSyncStatus: 'webhook_payment_method_attached',
			lastWebhookEvent: 'payment_method.attached',
			lastWebhookTimestamp: new Date(),
		};

		// Store card details if available
		if (paymentMethod.card) {
			updateData.cardLast4 = paymentMethod.card.last4;
			updateData.cardBrand = paymentMethod.card.brand;
			updateData.cardExpMonth = paymentMethod.card.exp_month;
			updateData.cardExpYear = paymentMethod.card.exp_year;
		}

		await updateUserProfile(user.userId, updateData);

		structuredConsole.log('✅ [STRIPE-WEBHOOK] Payment method attached for user:', user.userId);
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-WEBHOOK] Error handling payment method attached:', error);
		throw error;
	}
}
