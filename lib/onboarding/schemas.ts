import { z } from 'zod';

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
	planId: z.enum(['glow_up', 'viral_surge', 'fame_flex'], {
		required_error: 'planId is required',
		invalid_type_error: 'planId is invalid',
	}),
	interval: z.enum(['monthly', 'yearly'], {
		required_error: 'interval is required',
		invalid_type_error: 'interval is invalid',
	}),
});

export type Step1Input = z.infer<typeof Step1Schema>;
export type Step2Input = z.infer<typeof Step2Schema>;
export type PlanSelectionInput = z.infer<typeof PlanSelectionSchema>;

export const OnboardingStepOrder = [
	'info_captured',
	'intent_captured',
	'plan_selected',
	'completed',
] as const;

export type OnboardingStep = (typeof OnboardingStepOrder)[number];

export function assertStepOrder(current: string | null | undefined, target: OnboardingStep) {
	const currentIdx = current ? OnboardingStepOrder.indexOf(current as OnboardingStep) : -1;
	const targetIdx = OnboardingStepOrder.indexOf(target);
	if (targetIdx === -1) {
		throw new Error(`Unknown target step: ${target}`);
	}
	if (currentIdx > targetIdx) {
		throw new Error(`Step already completed: current=${current}, target=${target}`);
	}
	if (currentIdx + 1 < targetIdx) {
		throw new Error(`Out of order step: current=${current || 'none'}, target=${target}`);
	}
}
