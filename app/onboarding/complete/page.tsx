'use client';

import { useAuth } from '@clerk/nextjs';
import { ArrowRight, CheckCircle, CreditCard, Sparkles, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOnboardingStatus } from '@/lib/hooks/use-onboarding-status';
import { logError, loggedApiCall, logStepHeader } from '@/lib/utils/frontend-logger';

export default function OnboardingComplete() {
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const { userId, user, isLoaded, isSignedIn } = useAuth();
	const {
		isLoading: onboardingLoading,
		hasPlan,
		hasStripeSub,
		isPaidOrTrial,
		step,
	} = useOnboardingStatus();

	// Redirect to the correct step if prerequisites are missing
	useEffect(() => {
		if (!isLoaded || onboardingLoading) return;
		if (!isSignedIn) return router.replace('/onboarding/step-1');
		if (isPaidOrTrial) return router.replace('/dashboard');
		if (!hasPlan) return router.replace('/onboarding/step-2');
		if (!hasStripeSub) return router.replace('/onboarding/step-2');
	}, [isLoaded, onboardingLoading, isSignedIn, hasPlan, hasStripeSub, isPaidOrTrial, router]);

	useEffect(() => {
		logStepHeader('onboarding-complete', 'Final step loaded', {
			userId: userId || 'NO_USER',
			step,
		});
	}, [userId, step]);

	const handleStartTrial = async () => {
		if (!hasStripeSub) {
			toast.error('Finish payment to start the trial');
			router.push('/onboarding/step-3');
			return;
		}

		setIsLoading(true);
		try {
			const response = await loggedApiCall('/api/onboarding/complete', {
				method: 'PATCH',
				body: { completed: true },
			});

			const data = (response as any)._parsedData;
			if (!response.ok) {
				throw new Error(data?.error || 'Failed to complete onboarding');
			}

			toast.success('🎉 Trial started successfully! Redirecting...');
			router.push('/profile');
		} catch (error) {
			logError('trial_activation_failed', error, {
				userId,
				userEmail: user?.primaryEmailAddress?.emailAddress,
				step: 'trial-activation',
			});
			toast.error(
				`Error starting trial: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			router.push('/onboarding/step-3');
		} finally {
			setIsLoading(false);
		}
	};

	if (!isLoaded || onboardingLoading || !hasStripeSub || isPaidOrTrial === undefined) {
		return null;
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-10 sm:py-12">
			<div className="w-full max-w-2xl">
				<div className="mb-8">
					<div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
						<div className="h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-semibold">
							✓
						</div>
						<div className="h-1 w-10 rounded bg-green-600 sm:w-16"></div>
						<div className="h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-semibold">
							✓
						</div>
						<div className="h-1 w-10 rounded bg-green-600 sm:w-16"></div>
						<div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
							3
						</div>
					</div>
					<p className="text-center text-sm text-gray-600">Step 3 of 3: Ready for your trial!</p>
				</div>

				<Card className="shadow-xl border-0">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
							<CheckCircle className="w-8 h-8 text-green-600" />
						</div>
						<CardTitle className="text-3xl font-bold text-gray-900">You're All Set! 🎉</CardTitle>
						<CardDescription className="text-gray-600 mt-2 text-lg">
							Your profile is complete and our AI is ready to find perfect influencers for your
							brand.
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-6">
						<div className="bg-blue-50 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
								<Sparkles className="h-5 w-5" />
								What happens next?
							</h3>
							<div className="space-y-3">
								{[
									{
										label: 'Start your 7-day free trial',
										desc: 'Full access to all features, no immediate charge',
									},
									{
										label: 'Create your first campaign',
										desc: 'Search for influencers across TikTok, Instagram & YouTube',
									},
									{
										label: 'Get detailed insights',
										desc: 'Access contact info, analytics, and audience data',
									},
								].map((item, idx) => (
									<div className="flex items-start gap-3" key={item.label}>
										<div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
											{idx + 1}
										</div>
										<div>
											<p className="font-medium text-blue-900">{item.label}</p>
											<p className="text-sm text-blue-700">{item.desc}</p>
										</div>
									</div>
								))}
							</div>
						</div>

						<div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
								<Zap className="h-5 w-5 text-purple-600" />
								Your 7-day trial includes:
							</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{[
									'Unlimited influencer searches',
									'AI-powered recommendations',
									'Direct email extraction',
									'Advanced analytics',
									'CSV export functionality',
									'Priority support',
								].map((item) => (
									<div className="flex items-center gap-2" key={item}>
										<CheckCircle className="h-4 w-4 text-green-600" />
										<span className="text-sm">{item}</span>
									</div>
								))}
							</div>
						</div>

						<div className="space-y-4">
							<Button
								onClick={handleStartTrial}
								size="lg"
								className="w-full h-14 text-lg font-semibold"
								disabled={isLoading || !hasStripeSub}
							>
								{isLoading ? (
									<div className="flex items-center gap-2">
										<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
										Setting up your trial...
									</div>
								) : (
									<div className="flex items-center gap-2">
										<CreditCard className="h-5 w-5" />
										Start 7-Day Free Trial
										<ArrowRight className="h-5 w-5" />
									</div>
								)}
							</Button>
							{!hasStripeSub && (
								<p className="text-sm text-red-600 text-center">
									Add payment to continue the trial setup.
								</p>
							)}
						</div>

						<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
							<p className="text-sm text-yellow-800">
								<strong>Note:</strong> We'll ask for a payment method to start your trial, but you
								won't be charged until the trial ends. Cancel anytime during the trial period with
								no fees.
							</p>
						</div>
					</CardContent>
				</Card>

				<div className="mt-6 text-center">
					<p className="text-xs text-gray-500">
						Questions about the trial?{' '}
						<a href="mailto:support@gemz.io" className="text-blue-600 hover:underline">
							Contact our team
						</a>{' '}
						for immediate assistance.
					</p>
				</div>
			</div>
		</div>
	);
}
