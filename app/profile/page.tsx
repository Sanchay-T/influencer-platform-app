'use client';

import { useUser } from '@clerk/nextjs';
import {
	Building2,
	Calendar,
	CircleCheckBig,
	CreditCard,
	Crown,
	Factory,
	Mail,
	Settings,
	Star,
	User,
	Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import EmailScheduleDisplay from '@/components/trial/email-schedule-display';
import TrialStatusCard from '@/components/trial/trial-status-card';
import TrialStatusCardUser from '@/components/trial/trial-status-card-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAdmin } from '@/lib/hooks/use-admin';
import { useBilling } from '@/lib/hooks/use-billing';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { isValidPlanKey } from '@/lib/types/statuses';
import DashboardLayout from '../components/layout/dashboard-layout';
import { UserProfileModal } from '../components/profile/user-profile-modal';

export default function ProfileSettingsPage() {
	const { user, isLoaded } = useUser();
	const { isAdmin } = useAdmin();
	const { hasActiveSubscription, isTrialing } = useBilling();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showUserProfile, setShowUserProfile] = useState(false);
	const [userProfile, setUserProfile] = useState({
		name: '',
		companyName: '',
		industry: '',
		email: '',
		trialData: null,
		emailScheduleStatus: {},
	});

	useEffect(() => {
		async function getUserProfile() {
			if (!(isLoaded && user)) {
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				structuredConsole.log('🔍 [PROFILE-PAGE] Fetching user profile for:', user.id);

				// Try to fetch user profile data from our API
				const response = await fetch('/api/profile', {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				if (response.ok) {
					const profileData = await response.json();
					structuredConsole.log('✅ [PROFILE-PAGE] Profile data fetched:', profileData);

					setUserProfile({
						name: profileData.name || user.fullName || '',
						companyName: profileData.companyName || '',
						industry: profileData.industry || '',
						email: user.emailAddresses?.[0]?.emailAddress || '',
						trialData: profileData.trialData || null,
						emailScheduleStatus: profileData.emailScheduleStatus || {},
					});

					// Log trial information for debugging
					if (profileData.trialData) {
						structuredConsole.log('🎯 [PROFILE-PAGE] Trial data found:', {
							status: profileData.trialData.status,
							daysRemaining: profileData.trialData.daysRemaining,
							progressPercentage: profileData.trialData.progressPercentage,
							endDate: profileData.trialData.endDate,
						});
					} else {
						structuredConsole.log('ℹ️ [PROFILE-PAGE] No trial data found');
					}
				} else {
					// Profile doesn't exist yet, set default values from Clerk
					structuredConsole.log('ℹ️ [PROFILE-PAGE] No profile found, using Clerk user data');
					setUserProfile({
						name: user.fullName || '',
						companyName: '',
						industry: '',
						email: user.emailAddresses?.[0]?.emailAddress || '',
						trialData: null,
						emailScheduleStatus: {},
					});
				}
			} catch (fetchError) {
				structuredConsole.error('💥 [PROFILE-PAGE] Error fetching profile:', fetchError);
				setError('Error loading profile data');
			} finally {
				setLoading(false);
			}
		}

		getUserProfile();
	}, [isLoaded, user]);

	const handleManageAccount = () => {
		setShowUserProfile(true);
	};

	if (!isLoaded || loading) {
		return (
			<DashboardLayout>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div className="animate-pulse space-y-8">
						{/* Header skeleton */}
						<div>
							<div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
							<div className="h-4 bg-gray-200 rounded w-1/2"></div>
						</div>

						{/* Cards skeleton */}
						<div className="grid gap-6 lg:grid-cols-2">
							<div className="h-64 bg-gray-200 rounded-lg"></div>
							<div className="h-64 bg-gray-200 rounded-lg"></div>
						</div>

						{/* Content skeleton */}
						<div className="space-y-4">
							<div className="h-32 bg-gray-200 rounded-lg"></div>
							<div className="h-32 bg-gray-200 rounded-lg"></div>
						</div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="py-6 space-y-8 max-w-6xl mx-auto">
				{/* Page Header */}
				<div className="mb-2">
					<h1 className="text-2xl font-bold text-zinc-100">Account Settings</h1>
					<p className="mt-1 text-sm text-zinc-400">
						Manage your account information
						{isAdmin ? ', trial status, and email preferences' : ' and trial status'}
					</p>
				</div>

				{/* Main Content Area */}
				<div className="space-y-10">
					{/* Trial Status Section - Only show if user is actually trialing (not converted to paid) */}
					{userProfile.trialData && isTrialing && !hasActiveSubscription ? (
						<section>
							<h2 className="text-lg font-semibold text-zinc-100 mb-4">Trial Status</h2>
							{isAdmin ? (
								// Admin view: 2-column grid
								<div className="grid gap-6 lg:grid-cols-2">
									<TrialStatusCard trialData={userProfile.trialData} className="w-full" />
									<EmailScheduleDisplay
										emailScheduleStatus={userProfile.emailScheduleStatus}
										className="w-full"
									/>
								</div>
							) : (
								// Regular user view: Centered single card
								<div className="flex justify-center">
									<TrialStatusCardUser
										trialData={userProfile.trialData}
										className="w-full max-w-xl"
									/>
								</div>
							)}
						</section>
					) : null}

					{/* Admin Email Schedule - Show for admins even after conversion */}
					{isAdmin && userProfile.emailScheduleStatus && hasActiveSubscription && (
						<section>
							<h2 className="text-lg font-semibold text-zinc-100 mb-4">Email Schedule (Admin)</h2>
							<div className="flex justify-center">
								<EmailScheduleDisplay
									emailScheduleStatus={userProfile.emailScheduleStatus}
									className="w-full max-w-3xl"
								/>
							</div>
						</section>
					)}

					{/* Account Information Section */}
					<section>
						<h2 className="text-lg font-semibold text-zinc-100 mb-4">Account Information</h2>
						<div className="grid gap-6 lg:grid-cols-2 items-start">
							{/* Left column: Personal info + Account management */}
							<div className="space-y-6">
								{/* Personal Information Card */}
								<Card className="h-full min-h-[320px] bg-zinc-900/80 border border-zinc-700/50">
									<CardHeader>
										<CardTitle>Personal Information</CardTitle>
										<CardDescription>Your account and company details</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{error ? (
											<div className="text-sm text-red-400 p-4 bg-red-900/20 border border-red-800 rounded-md">
												{error}
											</div>
										) : (
											<div className="grid gap-4">
												<div className="flex items-center space-x-4">
													<User className="text-zinc-400 flex-shrink-0" size={20} />
													<div className="space-y-0.5 min-w-0">
														<Label className="text-sm font-medium">Name</Label>
														<p className="text-sm text-zinc-400 truncate">
															{userProfile.name || 'Not available'}
														</p>
													</div>
												</div>

												<div className="flex items-center space-x-4">
													<Mail className="text-zinc-400 flex-shrink-0" size={20} />
													<div className="space-y-0.5 min-w-0">
														<Label className="text-sm font-medium">Email</Label>
														<p className="text-sm text-zinc-400 truncate">
															{userProfile.email || 'Not available'}
														</p>
													</div>
												</div>

												<div className="flex items-center space-x-4">
													<Building2 className="text-zinc-400 flex-shrink-0" size={20} />
													<div className="space-y-0.5 min-w-0">
														<Label className="text-sm font-medium">Company</Label>
														<p className="text-sm text-zinc-400 truncate">
															{userProfile.companyName || 'Not set'}
														</p>
													</div>
												</div>

												<div className="flex items-center space-x-4">
													<Factory className="text-zinc-400 flex-shrink-0" size={20} />
													<div className="space-y-0.5 min-w-0">
														<Label className="text-sm font-medium">Industry</Label>
														<p className="text-sm text-zinc-400 truncate">
															{userProfile.industry || 'Not set'}
														</p>
													</div>
												</div>
											</div>
										)}
									</CardContent>
								</Card>

								{/* Account Management Card */}
								<Card className="h-fit bg-zinc-900/80 border border-zinc-700/50">
									<CardHeader>
										<CardTitle>Account Management</CardTitle>
										<CardDescription>
											Manage your email, password, and security settings
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="space-y-2">
												<Label className="text-sm font-medium">Account Settings</Label>
												<p className="text-sm text-zinc-400">
													Update your email, password, and security preferences
												</p>
											</div>
											<Button
												variant="outline"
												onClick={handleManageAccount}
												className="w-full flex items-center justify-center gap-2"
											>
												<Settings className="h-4 w-4" />
												Manage Account
											</Button>
										</div>
									</CardContent>
								</Card>
							</div>

							{/* Right column: Subscription card */}
							<div className="h-full">
								<SubscriptionPlanCard />
							</div>
						</div>
					</section>
				</div>
			</div>

			<UserProfileModal isOpen={showUserProfile} onClose={() => setShowUserProfile(false)} />
		</DashboardLayout>
	);
}

// SubscriptionPlanCard component using real billing status API with dark theme
function SubscriptionPlanCard() {
	type BillingStatusSummary = {
		currentPlan?: string;
		hasActiveSubscription?: boolean;
		isTrialing?: boolean;
		daysRemaining?: number;
	};
	const [billingStatus, setBillingStatus] = useState<BillingStatusSummary | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchBillingStatus() {
			try {
				const response = await fetch('/api/billing/status', { cache: 'no-store' });
				if (response.ok) {
					const data = await response.json();
					setBillingStatus(data);
				}
			} catch (error) {
				structuredConsole.error('Error fetching billing status:', error);
			} finally {
				setLoading(false);
			}
		}

		fetchBillingStatus();
	}, []);

	if (loading) {
		return (
			<Card className="h-fit bg-zinc-900/80 border border-zinc-700/50">
				<CardContent className="p-6">
					<div className="animate-pulse space-y-4">
						<div className="h-4 bg-zinc-700 rounded w-3/4"></div>
						<div className="h-8 bg-zinc-700 rounded w-1/2"></div>
						<div className="h-4 bg-zinc-700 rounded w-full"></div>
					</div>
				</CardContent>
			</Card>
		);
	}

	type PlanKey = 'free' | 'growth' | 'scale' | 'pro' | 'glow_up' | 'viral_surge' | 'fame_flex';
	const planConfig: Record<
		PlanKey,
		{
			name: string;
			icon: typeof Star;
			color: string;
			priceMonthly: string;
			priceYearly?: string;
			description: string;
			limits: string;
		}
	> = {
		free: {
			name: 'Free Plan',
			icon: Star,
			color: 'text-zinc-400',
			priceMonthly: '$0',
			description: 'Basic features',
			limits: 'Limited searches',
		},
		// New plans (Jan 2026)
		growth: {
			name: 'Growth',
			icon: Star,
			color: 'text-emerald-400',
			priceMonthly: '$199',
			priceYearly: '$159',
			description: 'Unlimited campaigns, 6,000 creators',
			limits: 'Unlimited campaigns',
		},
		scale: {
			name: 'Scale',
			icon: Zap,
			color: 'text-purple-400',
			priceMonthly: '$599',
			priceYearly: '$479',
			description: 'Unlimited campaigns, 30,000 creators',
			limits: 'Unlimited campaigns',
		},
		pro: {
			name: 'Pro',
			icon: Crown,
			color: 'text-yellow-400',
			priceMonthly: '$1,999',
			priceYearly: '$1,599',
			description: 'Unlimited campaigns, 75,000 creators',
			limits: 'Unlimited campaigns',
		},
		// Legacy plans (grandfathered)
		glow_up: {
			name: 'Glow Up',
			icon: Star,
			color: 'text-blue-400',
			priceMonthly: '$99',
			priceYearly: '$79',
			description: '3 campaigns, 1,000 creators',
			limits: '3 campaigns per month',
		},
		viral_surge: {
			name: 'Viral Surge',
			icon: Zap,
			color: 'text-pink-400',
			priceMonthly: '$249',
			priceYearly: '$199',
			description: '10 campaigns, 10,000 creators',
			limits: '10 campaigns per month',
		},
		fame_flex: {
			name: 'Fame Flex',
			icon: Crown,
			color: 'text-yellow-400',
			priceMonthly: '$499',
			priceYearly: '$399',
			description: 'Unlimited campaigns and creators',
			limits: 'Unlimited campaigns',
		},
	};

	const planCandidate = billingStatus?.currentPlan ?? '';
	const currentPlan: PlanKey = isValidPlanKey(planCandidate) ? planCandidate : 'free';
	const config = planConfig[currentPlan];
	const Icon = config?.icon || Star;

	const isActive = billingStatus?.hasActiveSubscription;
	const status = isActive ? 'Active' : billingStatus?.isTrialing ? 'Trial' : 'Inactive';

	// Calculate next billing date (mock for now)
	const nextBilling = new Date();
	nextBilling.setMonth(nextBilling.getMonth() + 1);

	return (
		<Card className="h-full min-h-[320px] bg-zinc-900/80 border border-zinc-700/50">
			<CardHeader className="pb-4">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
						<Icon className={`h-6 w-6 ${config?.color || 'text-zinc-400'}`} />
						<span className="font-semibold">{config?.name || 'Unknown Plan'}</span>
					</CardTitle>
					<Badge
						className={
							isActive
								? 'bg-zinc-800 text-pink-400 border border-zinc-700/50'
								: billingStatus?.isTrialing
									? 'bg-zinc-800 text-blue-400 border border-zinc-700/50'
									: 'bg-zinc-800 text-zinc-300 border border-zinc-700/50'
						}
					>
						<CircleCheckBig className="h-3 w-3 mr-1" />
						{status}
					</Badge>
				</div>
				<CardDescription className="mt-1 text-zinc-400">
					{isActive
						? 'Your subscription is active and all features are available.'
						: billingStatus?.isTrialing
							? 'Your trial is active with full feature access.'
							: 'Upgrade to access premium features.'}
				</CardDescription>
			</CardHeader>

			<CardContent className="pt-0 space-y-6">
				{/* Price Display */}
				<div className="text-center">
					<div className="text-2xl font-bold text-zinc-100 mb-1">
						{config?.priceMonthly || '$0'}/month
					</div>
					<p className="text-sm text-zinc-400">
						{currentPlan === 'free'
							? 'Free forever • Limited features'
							: `Billing monthly • ${config?.description || 'All features unlocked'}`}
					</p>
				</div>

				{/* Status Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
					<div className="flex items-start gap-3">
						<CreditCard className="h-4 w-4 text-zinc-400 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium text-zinc-300">Status</p>
							<p
								className={
									isActive
										? 'text-pink-400 font-medium'
										: billingStatus?.isTrialing
											? 'text-blue-400 font-medium'
											: 'text-zinc-400'
								}
							>
								{status}
							</p>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<Calendar className="h-4 w-4 text-zinc-400 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium text-zinc-300">Next Billing</p>
							<p className="text-zinc-400">
								{isActive
									? nextBilling.toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
										})
									: 'N/A'}
							</p>
						</div>
					</div>
				</div>

				{/* Plan Features */}
				<div className="space-y-2">
					<h4 className="font-medium text-zinc-300 text-sm">Plan Features</h4>
					<div className="space-y-1">
						<div className="flex items-center gap-2 text-sm text-zinc-400">
							<CircleCheckBig className="h-3 w-3 text-pink-400 flex-shrink-0" />
							<span>{config?.limits || 'Basic features'}</span>
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col sm:flex-row gap-3">
					<Link className="flex-1" href="/billing">
						<Button
							variant="outline"
							className="w-full border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50 hover:text-zinc-100"
						>
							<Settings className="h-4 w-4 mr-2" />
							Manage Subscription
						</Button>
					</Link>
					{/* Removed View All Plans link as /pricing is deprecated */}
				</div>

				{/* Status Message */}
				<div
					className={
						isActive
							? 'bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4'
							: billingStatus?.isTrialing
								? 'bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4'
								: 'bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4'
					}
				>
					<div className="flex items-start gap-3">
						<CircleCheckBig
							className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
								isActive
									? 'text-pink-400'
									: billingStatus?.isTrialing
										? 'text-blue-400'
										: 'text-zinc-400'
							}`}
						/>
						<div>
							<h4 className="font-medium text-sm text-zinc-100">
								{isActive
									? 'Subscription Active'
									: billingStatus?.isTrialing
										? 'Trial Active'
										: 'No Active Subscription'}
							</h4>
							<p className="text-sm mt-1 text-zinc-300">
								{isActive
									? `You have full access to all ${config?.name.toLowerCase()} features. Thank you for being a valued customer!`
									: billingStatus?.isTrialing
										? `You have full trial access. ${billingStatus.daysRemaining || 0} days remaining.`
										: 'Upgrade to access premium features and unlimited usage.'}
							</p>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
