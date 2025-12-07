'use client';

import { Fragment } from 'react';

/**
 * Progress indicator for onboarding steps.
 * Shows step numbers with checkmarks for completed steps.
 * 
 * Steps:
 * 1. Tell us about yourself (info)
 * 2. Tell us about your brand (intent)
 * 3. Choose your plan (checkout → redirects to Stripe)
 */

interface OnboardingProgressProps {
	currentStep: number;
	totalSteps?: number;
}

const stepLabels = [
	'Tell us about yourself',
	'Tell us about your brand',
	'Choose your plan',
];

export default function OnboardingProgress({
	currentStep,
	totalSteps = 3,
}: OnboardingProgressProps) {
	return (
		<div className="mb-6">
			<div className="flex items-center justify-center space-x-2 mb-4">
				{Array.from({ length: totalSteps }, (_, i) => {
					const stepNumber = i + 1;
					const isCompleted = currentStep > stepNumber;
					const isCurrent = currentStep >= stepNumber;

					return (
						<Fragment key={`progress-step-${stepNumber}`}>
							{/* Step circle */}
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
									isCurrent ? 'bg-primary text-primary-foreground' : 'bg-zinc-700/50 text-zinc-400'
								}`}
							>
								{isCompleted ? '✓' : stepNumber}
							</div>

							{/* Connector line (not after last step) */}
							{stepNumber < totalSteps && (
								<div
									className={`w-16 h-1 rounded ${
										currentStep > stepNumber ? 'bg-primary' : 'bg-zinc-700/50'
									}`}
								/>
							)}
						</Fragment>
					);
				})}
			</div>
			<p className="text-center text-sm text-muted-foreground">
				Step {currentStep} of {totalSteps}: {stepLabels[currentStep - 1] || ''}
			</p>
		</div>
	);
}
