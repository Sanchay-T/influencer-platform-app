import { ArrowRight, Calendar, CheckCircle, CreditCard, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type SessionData = {
	sessionId: string;
	planId: string;
	billing: 'monthly' | 'yearly';
	plan: {
		name: string;
		monthlyPrice: string;
		yearlyPrice: string;
		color: string;
		icon: string;
		features: string[];
	};
	subscription: {
		id: string;
		status: string;
		current_period_end: number;
		trial_end: number;
	};
	customer_email: string;
	payment_status: string;
	isUpgrade?: boolean;
};

interface Props {
	loading: boolean;
	sessionData: SessionData | null;
	isSubmitting: boolean;
	webhookConfirmed: boolean;
	onContinue: () => void;
}

const formatDate = (timestamp: number) =>
	new Date(timestamp * 1000).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

export function SuccessCard({
	loading,
	sessionData,
	isSubmitting,
	webhookConfirmed,
	onContinue,
}: Props) {
	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<div className="text-center">
					<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-muted-foreground">Loading subscription details...</p>
				</div>
			</div>
		);
	}

	const buttonDisabled = isSubmitting || !webhookConfirmed;
	const buttonText = isSubmitting
		? 'Finishing…'
		: webhookConfirmed
			? 'Go to dashboard'
			: 'Activating your plan…';

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<div className="w-full max-w-3xl">
				<Card className="bg-zinc-900/80 border border-zinc-700/50 shadow-xl">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 w-16 h-16 bg-zinc-800/60 rounded-full flex items-center justify-center">
							<CheckCircle className="w-8 h-8 text-primary" />
						</div>
						<CardTitle className="text-3xl font-bold text-foreground">
							Welcome to Gemz! 🎉
						</CardTitle>
						<CardDescription className="text-muted-foreground mt-2 text-lg">
							{sessionData
								? `Your ${sessionData.plan.name} subscription is active with a 7-day free trial.`
								: 'Your trial has started successfully. You now have full access to all features.'}
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-6">
						{sessionData && (
							<div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-6">
								<h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
									<Sparkles className="h-5 w-5 text-primary" /> Your Selected Plan
								</h3>
								<div className="flex items-center justify-between mb-4">
									<div>
										<div className="flex items-center gap-2">
											<span className="text-2xl font-bold text-foreground">
												{sessionData.plan.name}
											</span>
											<Badge
												variant="secondary"
												className="bg-zinc-800 text-primary border border-zinc-700/50"
											>
												{sessionData.billing === 'yearly' ? 'Annual' : 'Monthly'}
											</Badge>
										</div>
										<div className="text-lg text-muted-foreground mt-1">
											{sessionData.billing === 'yearly'
												? sessionData.plan.yearlyPrice
												: sessionData.plan.monthlyPrice}
											<span className="text-sm text-muted-foreground ml-1">per month</span>
											{sessionData.billing === 'yearly' && (
												<Badge
													variant="secondary"
													className="bg-zinc-800 text-primary border border-zinc-700/50 ml-2"
												>
													20% off
												</Badge>
											)}
										</div>
									</div>
									<div className="text-right text-sm text-muted-foreground">
										<div>Trial ends</div>
										<div className="font-medium text-foreground">
											{sessionData.subscription.trial_end
												? formatDate(sessionData.subscription.trial_end)
												: 'Not set'}
										</div>
									</div>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
									{sessionData.plan.features.map((feature) => (
										<div key={feature} className="flex items-center gap-2">
											<CheckCircle className="h-4 w-4 text-primary" />
											<span>{feature}</span>
										</div>
									))}
								</div>
							</div>
						)}

						<div className="bg-gradient-to-r from-purple-50/5 to-pink-50/5 border border-zinc-700/50 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
								<CreditCard className="h-5 w-5 text-primary" /> Next steps
							</h3>
							<div className="space-y-2 text-sm text-muted-foreground">
								<div className="flex items-center gap-2">
									<ArrowRight className="h-4 w-4" />
									Start your 7-day trial
								</div>
								<div className="flex items-center gap-2">
									<ArrowRight className="h-4 w-4" />
									Create your first campaign
								</div>
								<div className="flex items-center gap-2">
									<ArrowRight className="h-4 w-4" />
									Get detailed insights
								</div>
							</div>
						</div>

						<Button
							onClick={onContinue}
							size="lg"
							className="w-full h-14 text-lg font-semibold"
							disabled={buttonDisabled}
						>
							{!webhookConfirmed && (
								<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
							)}
							{buttonText}
						</Button>

						<div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4 text-sm text-muted-foreground flex items-start gap-2">
							<Calendar className="h-4 w-4 mt-0.5" />
							<span>We’ll charge your card when the trial ends. Cancel anytime before then.</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
