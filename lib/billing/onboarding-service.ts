/**
 * ═══════════════════════════════════════════════════════════════
 * ONBOARDING SERVICE - Manage Onboarding Flow
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles the 4-step onboarding process:
 * 1. info_captured - Full name + business name
 * 2. intent_captured - Brand description
 * 3. plan_selected - Plan selection → Stripe checkout
 * 4. completed - Success (set by webhook after payment)
 *
 * Responsibilities:
 * - Validate and process onboarding steps
 * - Track step progression
 * - Queue emails (welcome, abandonment)
 * - Provide onboarding status
 */

import { z } from 'zod';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import {
	scheduleEmail,
	shouldSendEmail,
	updateEmailScheduleStatus,
} from '@/lib/email/email-service';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { toError } from '@/lib/utils/type-guards';
import type { BillingInterval, PlanKey } from './plan-config';

const logger = createCategoryLogger(LogCategory.BILLING);

// ═══════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════

export type OnboardingStep =
	| 'pending'
	| 'info_captured'
	| 'intent_captured'
	| 'plan_selected'
	| 'completed';

export const OnboardingSteps: ReadonlyArray<OnboardingStep> = [
	'pending',
	'info_captured',
	'intent_captured',
	'plan_selected',
	'completed',
];

export const isOnboardingStep = (value: string): value is OnboardingStep =>
	OnboardingSteps.some((step) => step === value);

// Validation helpers
const nonEmptyTrimmed = (label: string, max: number) =>
	z
		.string({ required_error: `${label} is required` })
		.transform((v) => v?.trim?.() ?? '')
		.refine((v) => v.length > 0, `${label} is required`)
		.refine((v) => v.length <= max, `${label} must be at most ${max} characters`);

export const Step1Schema = z.object({
	fullName: nonEmptyTrimmed('Full name', 120),
	businessName: nonEmptyTrimmed('Business name', 120),
});

export const Step2Schema = z.object({
	brandDescription: nonEmptyTrimmed('Brand description', 1500),
});

export const PlanSelectionSchema = z.object({
	planId: z.enum(['growth', 'scale', 'pro', 'glow_up', 'viral_surge', 'fame_flex']),
	interval: z.enum(['monthly', 'yearly']),
});

export type Step1Data = z.infer<typeof Step1Schema>;
export type Step2Data = z.infer<typeof Step2Schema>;
export type PlanSelectionData = z.infer<typeof PlanSelectionSchema>;

export interface OnboardingStatus {
	currentStep: OnboardingStep;
	isComplete: boolean;
	canProceed: boolean;
	nextStep: OnboardingStep | null;
	stepsCompleted: OnboardingStep[];
}

// ═══════════════════════════════════════════════════════════════
// STEP ORDER VALIDATION
// ═══════════════════════════════════════════════════════════════

function getStepIndex(step: OnboardingStep | string | null | undefined): number {
	if (!step) return 0; // 'pending' is index 0
	if (!isOnboardingStep(step)) {
		return 0;
	}
	const index = OnboardingSteps.indexOf(step);
	return index >= 0 ? index : 0;
}

function assertStepOrder(current: string | null | undefined, target: OnboardingStep): void {
	const currentIdx = getStepIndex(current);
	const targetIdx = OnboardingSteps.indexOf(target);

	if (targetIdx === -1) {
		throw new Error(`Unknown target step: ${target}`);
	}

	// Allow going to the same step or the next step
	// Also allow skipping back for retries
	if (currentIdx > targetIdx + 1) {
		throw new Error(`Cannot go backwards: current=${current}, target=${target}`);
	}
}

// ═══════════════════════════════════════════════════════════════
// ONBOARDING SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

export class OnboardingService {
	/**
	 * Process Step 1: Name + Business Name
	 */
	static async processStep1(userId: string, data: Step1Data): Promise<void> {
		logger.info('Processing onboarding step 1', {
			userId,
			metadata: { fullName: data.fullName, businessName: data.businessName },
		});

		// Validate input
		const validated = Step1Schema.parse(data);

		// Get current user to check step order
		const user = await getUserProfile(userId);
		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		// Validate step order (must be at pending or info_captured)
		assertStepOrder(user.onboardingStep, 'info_captured');

		// Update user profile
		await updateUserProfile(userId, {
			fullName: validated.fullName,
			businessName: validated.businessName,
			onboardingStep: 'info_captured',
		});

		logger.info('Step 1 completed', { userId });
	}

	/**
	 * Process Step 2: Brand Description
	 */
	static async processStep2(userId: string, data: Step2Data): Promise<void> {
		logger.info('Processing onboarding step 2', { userId });

		// Validate input
		const validated = Step2Schema.parse(data);

		// Get current user to check step order
		const user = await getUserProfile(userId);
		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		// Validate step order (must have completed step 1)
		assertStepOrder(user.onboardingStep, 'intent_captured');

		// Update user profile
		await updateUserProfile(userId, {
			brandDescription: validated.brandDescription,
			onboardingStep: 'intent_captured',
		});

		logger.info('Step 2 completed', { userId });
	}

	/**
	 * Process Step 3: Plan Selection
	 * Note: This just records the intent. Actual checkout is handled by CheckoutService.
	 * The 'plan_selected' step is set after successful checkout redirect.
	 */
	static async processPlanSelection(userId: string, data: PlanSelectionData): Promise<void> {
		logger.info('Processing plan selection', {
			userId,
			metadata: { plan: data.planId, interval: data.interval },
		});

		// Validate input
		const validated = PlanSelectionSchema.parse(data);

		// Get current user to check step order
		const user = await getUserProfile(userId);
		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		// Validate step order (must have completed step 2)
		assertStepOrder(user.onboardingStep, 'plan_selected');

		// Record intended plan (actual plan is set by webhook after payment)
		await updateUserProfile(userId, {
			intendedPlan: validated.planId,
			onboardingStep: 'plan_selected',
		});

		logger.info('Plan selection recorded', { userId });
	}

	/**
	 * Mark onboarding as complete.
	 * Note: This is typically called by the webhook handler after successful payment.
	 */
	static async markComplete(userId: string): Promise<void> {
		logger.info('Marking onboarding complete', { userId });

		await updateUserProfile(userId, {
			onboardingStep: 'completed',
		});

		logger.info('Onboarding marked complete', { userId });
	}

	/**
	 * Get current onboarding status.
	 */
	static async getStatus(userId: string): Promise<OnboardingStatus> {
		const user = await getUserProfile(userId);

		if (!user) {
			return {
				currentStep: 'pending',
				isComplete: false,
				canProceed: true,
				nextStep: 'info_captured',
				stepsCompleted: [],
			};
		}

		const rawStep = typeof user.onboardingStep === 'string' ? user.onboardingStep : '';
		const currentStep = isOnboardingStep(rawStep) ? rawStep : 'pending';
		const currentIndex = getStepIndex(currentStep);
		const isComplete = currentStep === 'completed';

		// Get completed steps
		const stepsCompleted: OnboardingStep[] = OnboardingSteps.slice(0, currentIndex + 1).filter(
			(step) => step !== 'pending'
		);

		// Determine next step
		let nextStep: OnboardingStep | null = null;
		if (!isComplete && currentIndex < OnboardingSteps.length - 1) {
			nextStep = OnboardingSteps[currentIndex + 1];
		}

		return {
			currentStep,
			isComplete,
			canProceed: !isComplete,
			nextStep,
			stepsCompleted,
		};
	}

	// ─────────────────────────────────────────────────────────────
	// EMAIL HOOKS
	// ─────────────────────────────────────────────────────────────

	/**
	 * Queue welcome email after successful onboarding.
	 */
	static async queueWelcomeEmail(
		userId: string,
		email: string,
		fullName: string,
		businessName: string
	): Promise<{ success: boolean; messageId?: string; error?: string }> {
		const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`;

		if (!(await shouldSendEmail(userId, 'welcome'))) {
			return { success: true }; // Already sent or not needed
		}

		try {
			const result = await scheduleEmail({
				userId,
				emailType: 'welcome',
				userEmail: email,
				templateProps: { fullName, businessName, dashboardUrl },
			});

			if (result.success) {
				await updateEmailScheduleStatus(userId, 'welcome', 'scheduled', result.messageId);
				logger.info('Welcome email queued', {
					userId,
					metadata: { messageId: result.messageId },
				});
			}

			return result;
		} catch (error) {
			logger.error('Failed to queue welcome email', toError(error), { userId });
			return { success: false, error: 'Failed to queue email' };
		}
	}

	/**
	 * Queue abandonment email for users who start but don't complete onboarding.
	 */
	static async queueAbandonmentEmail(
		userId: string,
		email: string,
		fullName: string,
		businessName: string
	): Promise<{ success: boolean; messageId?: string; error?: string }> {
		const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`;

		if (!(await shouldSendEmail(userId, 'abandonment'))) {
			return { success: true }; // Already sent or not needed
		}

		try {
			const result = await scheduleEmail({
				userId,
				emailType: 'abandonment',
				userEmail: email,
				templateProps: { fullName, businessName, dashboardUrl },
			});

			if (result.success) {
				await updateEmailScheduleStatus(userId, 'abandonment', 'scheduled', result.messageId);
				logger.info('Abandonment email queued', {
					userId,
					metadata: { messageId: result.messageId },
				});
			}

			return result;
		} catch (error) {
			logger.error('Failed to queue abandonment email', toError(error), { userId });
			return { success: false, error: 'Failed to queue email' };
		}
	}

	/**
	 * Queue both welcome and abandonment emails.
	 * Used after step 1 completion.
	 */
	static async queueOnboardingEmails(
		userId: string,
		email: string,
		fullName: string,
		businessName: string
	): Promise<{
		welcome: { success: boolean; messageId?: string; error?: string };
		abandonment: { success: boolean; messageId?: string; error?: string };
	}> {
		const [welcomeResult, abandonmentResult] = await Promise.all([
			OnboardingService.queueWelcomeEmail(userId, email, fullName, businessName),
			OnboardingService.queueAbandonmentEmail(userId, email, fullName, businessName),
		]);

		return {
			welcome: welcomeResult,
			abandonment: abandonmentResult,
		};
	}
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════

export const processStep1 = OnboardingService.processStep1;
export const processStep2 = OnboardingService.processStep2;
export const processPlanSelection = OnboardingService.processPlanSelection;
export const markOnboardingComplete = OnboardingService.markComplete;
export const getOnboardingStatus = OnboardingService.getStatus;
export const queueWelcomeEmail = OnboardingService.queueWelcomeEmail;
export const queueAbandonmentEmail = OnboardingService.queueAbandonmentEmail;
export const queueOnboardingEmails = OnboardingService.queueOnboardingEmails;
