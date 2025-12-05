'use client';

/**
 * Progress indicator for onboarding steps.
 * Shows step numbers with checkmarks for completed steps.
 */

interface OnboardingProgressProps {
	currentStep: number;
	totalSteps?: number;
}

const stepLabels = [
	'Tell us about yourself',
	'Tell us about your brand',
	'Choose your plan',
	'Ready to start!',
];

export default function OnboardingProgress({
	currentStep,
	totalSteps = 4,
}: OnboardingProgressProps) {
	return (
		<div className="mb-6">
			<div className="flex items-center justify-center space-x-2 mb-4">
				{Array.from({ length: totalSteps }, (_, i) => {
					const stepNumber = i + 1;
					const isCompleted = currentStep > stepNumber;
					const isCurrent = currentStep >= stepNumber;

					return (
						<>
							{/* Step circle */}
							<div
								key={`step-${stepNumber}`}
								className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
									isCurrent ? 'bg-primary text-primary-foreground' : 'bg-zinc-700/50 text-zinc-400'
								}`}
							>
								{isCompleted ? '✓' : stepNumber}
							</div>

							{/* Connector line (not after last step) */}
							{stepNumber < totalSteps && (
								<div
									key={`line-${stepNumber}`}
									className={`w-16 h-1 rounded ${
										currentStep > stepNumber ? 'bg-primary' : 'bg-zinc-700/50'
									}`}
								/>
							)}
						</>
					);
				})}
			</div>
			<p className="text-center text-sm text-muted-foreground">
				Step {currentStep} of {totalSteps}: {stepLabels[currentStep - 1] || ''}
			</p>
		</div>
	);
}
