'use client';

import { Protect as ClerkProtect } from '@clerk/nextjs';
import { Crown, Lock, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBilling, useFeatureAccess, usePlanAccess } from '@/lib/hooks/use-billing';
import type { PlanKey } from '@/lib/types/statuses';

interface ProtectProps {
	children: React.ReactNode;
	feature?: string;
	plan?: string;
	fallback?: React.ReactNode;
	showUpgradePrompt?: boolean;
}

/**
 * Enhanced Protect component that works with Clerk billing
 */
export function Protect({
	children,
	feature,
	plan,
	fallback,
	showUpgradePrompt = true,
}: ProtectProps) {
	const featureAccess = useFeatureAccess(feature);
	const planAccess = usePlanAccess(plan);

	// Use feature access if feature is specified
	if (feature) {
		const { hasAccess, isLoaded, currentPlan } = featureAccess;

		if (!isLoaded) {
			return (
				<div className="flex items-center justify-center p-4">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
				</div>
			);
		}

		if (!hasAccess) {
			if (fallback) {
				return <>{fallback}</>;
			}

			if (showUpgradePrompt) {
				return <UpgradePrompt feature={feature} currentPlan={currentPlan} />;
			}

			return null;
		}

		return <>{children}</>;
	}

	// Use plan access if plan is specified
	if (plan) {
		const { hasAccess, isLoaded } = planAccess;

		if (!isLoaded) {
			return (
				<div className="flex items-center justify-center p-4">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
				</div>
			);
		}

		if (!hasAccess) {
			if (fallback) {
				return <>{fallback}</>;
			}

			if (showUpgradePrompt) {
				return <UpgradePrompt plan={plan} />;
			}

			return null;
		}

		return <>{children}</>;
	}

	// Fall back to Clerk's built-in Protect component for other use cases
	return <ClerkProtect fallback={fallback}>{children}</ClerkProtect>;
}

/**
 * Upgrade prompt component
 */
function UpgradePrompt({
	feature,
	plan,
	currentPlan,
}: {
	feature?: string;
	plan?: string;
	currentPlan?: string;
}) {
	const { isPaidUser, isTrialing } = useBilling();
	const getPromptContent = () => {
		if (feature) {
			const featureDetails = {
				instagram_search: {
					title: 'Instagram Search',
					description: 'Search Instagram creators and influencers',
					icon: <Zap className="h-5 w-5" />,
					requiredPlan: 'Premium',
				},
				youtube_search: {
					title: 'YouTube Search',
					description: 'Search YouTube creators and channels',
					icon: <Zap className="h-5 w-5" />,
					requiredPlan: 'Premium',
				},
				csv_export: {
					title: 'CSV Export',
					description: 'Export search results to CSV files',
					icon: <Zap className="h-5 w-5" />,
					requiredPlan: 'Premium',
				},
				api_access: {
					title: 'API Access',
					description: 'Programmatic access to our platform',
					icon: <Crown className="h-5 w-5" />,
					requiredPlan: 'Enterprise',
				},
			};
			type FeatureKey = keyof typeof featureDetails;
			const isFeatureKey = (value: string): value is FeatureKey => value in featureDetails;
			const details = isFeatureKey(feature) ? featureDetails[feature] : undefined;
			if (details) {
				return {
					title: `${details.title} - ${details.requiredPlan} Feature`,
					description: details.description,
					icon: details.icon,
					requiredPlan: details.requiredPlan,
				};
			}
		}

		if (plan) {
			return {
				title: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Required`,
				description: `This feature requires a ${plan} subscription`,
				icon: plan === 'enterprise' ? <Crown className="h-5 w-5" /> : <Zap className="h-5 w-5" />,
				requiredPlan: plan.charAt(0).toUpperCase() + plan.slice(1),
			};
		}

		return {
			title: 'Premium Feature',
			description: 'This feature requires a paid subscription',
			icon: <Lock className="h-5 w-5" />,
			requiredPlan: 'Premium',
		};
	};

	const content = getPromptContent();

	return (
		<Card className="border-2 border-dashed border-gray-300 bg-gray-50">
			<CardHeader className="text-center">
				<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
					{content.icon}
				</div>
				<CardTitle className="text-lg">{content.title}</CardTitle>
				<CardDescription>{content.description}</CardDescription>
			</CardHeader>
			<CardContent className="text-center space-y-4">
				<div className="text-sm text-gray-600">
					Current plan:{' '}
					<span className="font-medium capitalize">
						{isPaidUser ? currentPlan : isTrialing ? 'Free Trial' : 'Free'}
					</span>
				</div>
				<div className="flex gap-2 justify-center">
					<Link href="/billing?upgrade=1">
						<Button>
							{isPaidUser ? `Upgrade to ${content.requiredPlan}` : `Get ${content.requiredPlan}`}
						</Button>
					</Link>
					<Link href="/billing">
						<Button variant="outline">View Billing</Button>
					</Link>
				</div>
				{/* Additional context for trial users */}
				{isTrialing && (
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
						<p className="text-sm text-blue-800">
							✨ You&apos;re currently on a free trial. Upgrade to unlock all features and continue
							using the platform after your trial ends.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Inline feature gate component for smaller UI elements
 */
export function FeatureGate({
	feature,
	children,
	fallback,
}: {
	feature: string;
	children: React.ReactNode;
	fallback?: React.ReactNode;
}) {
	const { hasAccess, isLoaded } = useFeatureAccess(feature);

	if (!isLoaded) return null;

	if (!hasAccess) {
		return fallback ? <>{fallback}</> : null;
	}

	return <>{children}</>;
}

/**
 * Plan badge component to show current plan
 */
export function PlanBadge({ className }: { className?: string }) {
	const { currentPlan, isLoaded } = useBilling();

	if (!isLoaded) return null;

	const badgeStyles: Record<PlanKey, string> = {
		free: 'bg-gray-100 text-gray-800',
		// New plans (Jan 2026)
		growth: 'bg-emerald-100 text-emerald-800',
		scale: 'bg-purple-100 text-purple-800',
		pro: 'bg-yellow-100 text-yellow-800',
		// Legacy plans (grandfathered)
		glow_up: 'bg-blue-100 text-blue-800',
		viral_surge: 'bg-purple-100 text-purple-800',
		fame_flex: 'bg-yellow-100 text-yellow-800',
	};

	const planNames: Record<PlanKey, string> = {
		free: 'Free',
		// New plans (Jan 2026)
		growth: 'Growth',
		scale: 'Scale',
		pro: 'Pro',
		// Legacy plans (grandfathered)
		glow_up: 'Glow Up',
		viral_surge: 'Viral Surge',
		fame_flex: 'Fame Flex',
	};

	const planStyle = badgeStyles[currentPlan];
	const displayName = planNames[currentPlan] || currentPlan;

	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planStyle} ${className || ''}`}
		>
			{displayName}
		</span>
	);
}
