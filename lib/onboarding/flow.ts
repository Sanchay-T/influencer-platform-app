import { EventService } from '@/lib/events/event-service';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import {
	logError as logErrorShared,
	logMilestone as logMilestoneShared,
} from '@/lib/logging/onboarding-logger';
import { queueWelcomeAndAbandonment } from './email-hooks';
import { assertStepOrder, type OnboardingStep } from './schemas';

const log = createCategoryLogger(LogCategory.ONBOARDING);

export interface OnboardingContext {
	userId: string;
	email?: string | null;
	fullName?: string | null;
	businessName?: string | null;
	onboardingStep?: string | null;
	currentPlan?: string | null;
	intendedPlan?: string | null;
	stripeCustomerId?: string | null;
	stripeSubscriptionId?: string | null;
}

export interface TransitionOptions {
	requestId?: string;
	source?: 'user_action' | 'stripe_webhook' | 'system_automation';
	metadata?: Record<string, unknown>;
}

export async function recordTransition(
	ctx: OnboardingContext,
	eventType:
		| 'onboarding_started'
		| 'onboarding_completed'
		| 'plan_selected'
		| 'payment_succeeded'
		| 'payment_failed'
		| 'onboarding_step'
		| 'trial_started',
	data: Record<string, unknown>,
	opts: TransitionOptions = {}
) {
	const idempotencyKey = `${ctx.userId}:${eventType}:${opts.requestId || Date.now()}`;
	await EventService.createEvent({
		aggregateId: ctx.userId,
		aggregateType: 'onboarding',
		eventType,
		eventData: { ...data, requestId: opts.requestId },
		metadata: opts.metadata,
		sourceSystem: opts.source || 'user_action',
		idempotencyKey,
	});
}

export function ensureStep(currentStep: string | null | undefined, target: OnboardingStep) {
	try {
		assertStepOrder(currentStep, target);
	} catch (err) {
		log.warn('Step order violation', {
			metadata: { currentStep: currentStep || 'none', target },
		});
		throw err;
	}
}

export async function sendOnboardingEmails(ctx: OnboardingContext, dashboardUrl: string) {
	if (!ctx.email) return { welcome: null, abandonment: null };

	return queueWelcomeAndAbandonment({
		userId: ctx.userId,
		email: ctx.email,
		fullName: ctx.fullName || 'there',
		businessName: ctx.businessName || 'your business',
		dashboardUrl,
	});
}

export function maskEmail(email?: string | null) {
	if (!email) return null;
	const [user, domain] = email.split('@');
	const maskedUser =
		user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}***${user[user.length - 1]}`;
	return `${maskedUser}@${domain || ''}`;
}

export function milestone(
	message: string,
	ctx: OnboardingContext,
	extra?: Record<string, unknown>
) {
	const metadata = {
		email: maskEmail(ctx.email),
		step: ctx.onboardingStep,
		currentPlan: ctx.currentPlan,
		intendedPlan: ctx.intendedPlan,
		...extra,
	};

	log.info(message, { userId: ctx.userId, metadata });
	logMilestoneShared(message, {
		userId: ctx.userId,
		email: ctx.email,
		step: ctx.onboardingStep,
		plan: ctx.currentPlan || ctx.intendedPlan || undefined,
		data: metadata,
	});
}

export function captureError(evt: string, err: Error, ctx: OnboardingContext) {
	logErrorShared(evt, err, {
		userId: ctx.userId,
		email: ctx.email,
		step: ctx.onboardingStep,
		plan: ctx.currentPlan || ctx.intendedPlan || undefined,
	});
}
