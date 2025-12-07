'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { structuredConsole } from '@/lib/logging/console-proxy';
import OnboardingLogger from '@/lib/utils/onboarding-logger';
import OnboardingProgress from './onboarding-progress';
import Step1Info from './step-1-info';
import Step2Brand from './step-2-brand';
import Step3Plan from './step-3-plan';

interface OnboardingModalProps {
	isOpen: boolean;
	onComplete: () => void;
	initialStep?: number;
	existingData?: {
		fullName?: string;
		businessName?: string;
		brandDescription?: string;
	};
}

export default function OnboardingModal({
	isOpen,
	onComplete,
	initialStep = 1,
	existingData,
}: OnboardingModalProps) {
	const { user } = useUser();
	const [step, setStep] = useState(initialStep);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [sessionId] = useState(OnboardingLogger.generateSessionId());

	// Form data
	const [fullName, setFullName] = useState(existingData?.fullName || '');
	const [businessName, setBusinessName] = useState(existingData?.businessName || '');
	const [brandDescription, setBrandDescription] = useState(existingData?.brandDescription || '');

	// Log modal lifecycle events
	useEffect(() => {
		if (isOpen) {
			OnboardingLogger.logModalEvent(
				'OPEN',
				step,
				user?.id,
				{
					initialStep,
					hasExistingData: !!existingData,
					existingData: existingData ? Object.keys(existingData) : [],
				},
				sessionId
			);
		} else {
			OnboardingLogger.logModalEvent('CLOSE', step, user?.id, { finalStep: step }, sessionId);
		}
	}, [isOpen, step, user?.id, initialStep, existingData, sessionId]);

	// Log step changes
	useEffect(() => {
		if (isOpen) {
			OnboardingLogger.logModalEvent(
				'STEP_CHANGE',
				step,
				user?.id,
				{
					previousStep: step - 1,
					currentStep: step,
					direction: 'forward',
				},
				sessionId
			);
		}
	}, [step, isOpen, user?.id, sessionId]);

	if (!isOpen) {
		return null;
	}

	// ─────────────────────────────────────────────────────────────
	// STEP 1 HANDLER
	// ─────────────────────────────────────────────────────────────

	const handleStep1Submit = async () => {
		await OnboardingLogger.logStep1(
			'FORM-VALIDATION',
			'Starting step 1 form validation',
			user?.id,
			{
				fullNameProvided: !!fullName.trim(),
				businessNameProvided: !!businessName.trim(),
				fullNameLength: fullName.length,
				businessNameLength: businessName.length,
			},
			sessionId
		);

		if (!(fullName.trim() && businessName.trim())) {
			await OnboardingLogger.logStep1(
				'VALIDATION-ERROR',
				'Step 1 validation failed - missing required fields',
				user?.id,
				{
					fullNameMissing: !fullName.trim(),
					businessNameMissing: !businessName.trim(),
				},
				sessionId
			);
			setError('Please fill in all fields');
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			await OnboardingLogger.logAPI(
				'API-CALL-START',
				'Making API call to /api/onboarding/step-1',
				user?.id,
				{
					endpoint: '/api/onboarding/step-1',
					method: 'PATCH',
				},
				sessionId
			);

			const response = await fetch('/api/onboarding/step-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullName: fullName.trim(),
					businessName: businessName.trim(),
				}),
			});

			const data = await response.json();

			await OnboardingLogger.logAPI(
				'API-RESPONSE',
				'Received response from /api/onboarding/step-1',
				user?.id,
				{ status: response.status, ok: response.ok },
				sessionId
			);

			if (!response.ok) {
				throw new Error(data.error || 'Failed to save information');
			}

			toast.success('Profile information saved!');
			setStep(2);
		} catch (err) {
			structuredConsole.error('❌ Error saving step 1:', err);
			const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
			setError(errorMessage);
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	// ─────────────────────────────────────────────────────────────
	// STEP 2 HANDLER
	// ─────────────────────────────────────────────────────────────

	const handleStep2Submit = async () => {
		if (!brandDescription.trim()) {
			setError('Please describe your brand and influencer preferences');
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			await OnboardingLogger.logAPI(
				'API-CALL-START',
				'Making API call to /api/onboarding/step-2',
				user?.id,
				{ endpoint: '/api/onboarding/step-2', method: 'PATCH' },
				sessionId
			);

			const response = await fetch('/api/onboarding/step-2', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ brandDescription: brandDescription.trim() }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to save information');
			}

			toast.success('Brand description saved!');
			setStep(3);
		} catch (err) {
			structuredConsole.error('❌ Error saving step 2:', err);
			const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
			setError(errorMessage);
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	// ─────────────────────────────────────────────────────────────
	// STEP 3 HANDLER (Plan Selection)
	// Note: PaymentStep handles Stripe redirect directly.
	// After Stripe checkout, user lands on /onboarding/success page.
	// ─────────────────────────────────────────────────────────────

	// No handler needed - PaymentStep redirects to Stripe checkout

	// ─────────────────────────────────────────────────────────────
	// INPUT CHANGE HANDLERS WITH LOGGING
	// ─────────────────────────────────────────────────────────────

	const handleFullNameChange = (value: string) => {
		setFullName(value);
		OnboardingLogger.logUserInput(1, 'fullName', value, user?.id, sessionId);
	};

	const handleBusinessNameChange = (value: string) => {
		setBusinessName(value);
		OnboardingLogger.logUserInput(1, 'businessName', value, user?.id, sessionId);
	};

	const handleBrandDescriptionChange = (value: string) => {
		setBrandDescription(value);
		OnboardingLogger.logUserInput(2, 'brandDescription', value, user?.id, sessionId);
	};

	const handleExampleSelect = (prompt: string, index: number) => {
		setBrandDescription(prompt);
		OnboardingLogger.logStep2(
			'EXAMPLE-SELECTED',
			'User selected example prompt',
			user?.id,
			{ exampleIndex: index, promptLength: prompt.length },
			sessionId
		);
	};

	// ─────────────────────────────────────────────────────────────
	// RENDER
	// ─────────────────────────────────────────────────────────────

	return (
		<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
			<div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
				<OnboardingProgress currentStep={step} />

				<Card className="bg-zinc-900/80 border border-zinc-700/50">
					{step === 1 && (
						<Step1Info
							fullName={fullName}
							businessName={businessName}
							onFullNameChange={handleFullNameChange}
							onBusinessNameChange={handleBusinessNameChange}
							onSubmit={handleStep1Submit}
							isLoading={isLoading}
							error={error}
						/>
					)}

					{step === 2 && (
						<Step2Brand
							brandDescription={brandDescription}
							onBrandDescriptionChange={handleBrandDescriptionChange}
							onExampleSelect={handleExampleSelect}
							onSubmit={handleStep2Submit}
							isLoading={isLoading}
							error={error}
						/>
					)}

					{step === 3 && (
						<Step3Plan sessionId={sessionId} userId={user?.id} />
					)}
				</Card>
			</div>
		</div>
	);
}
