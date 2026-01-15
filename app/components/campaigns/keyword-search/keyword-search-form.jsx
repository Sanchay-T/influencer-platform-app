'use client';

import { useUser } from '@clerk/nextjs';
import { Check, Crown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Slider } from '@/components/ui/slider';
import { useTrialStatus } from '@/lib/hooks/use-trial-status';
import { cn } from '@/lib/utils';

// Trial limit - only 100 is available
const TRIAL_MAX_RESULTS = 100;
// Snap-back delay in ms (lets user "taste" the premium value)
const SNAPBACK_DELAY = 400;

export default function KeywordSearchForm({ onSubmit }) {
	const [selectedPlatform, setSelectedPlatform] = useState('tiktok');
	const [creatorsCount, setCreatorsCount] = useState(100);
	const [isLoading, setIsLoading] = useState(false);
	const [campaignId, setCampaignId] = useState(null);
	const [isSnappingBack, setIsSnappingBack] = useState(false);
	const snapbackTimeoutRef = useRef(null);
	const { user, isLoaded } = useUser();
	const { isTrialUser, searchesRemaining, isLoading: trialLoading } = useTrialStatus();

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (snapbackTimeoutRef.current) {
				clearTimeout(snapbackTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		// Get campaignId from URL if exists
		const urlParams = new URLSearchParams(window.location.search);
		const urlCampaignId = urlParams.get('campaignId');
		if (urlCampaignId) {
			setCampaignId(urlCampaignId);
		}
	}, []);

	// Note: Trial user lock is now handled by snap-back in handleSliderChange

	// Slider change handler with snap-back for trial users
	// Must be defined before early return to satisfy React hooks rules
	const handleSliderChange = useCallback(
		([value]) => {
			// Non-trial users can select any value
			if (!isTrialUser) {
				setCreatorsCount(value);
				return;
			}

			// Trial users: allow them to "taste" premium values briefly
			if (value > TRIAL_MAX_RESULTS) {
				// Show the premium value
				setCreatorsCount(value);
				setIsSnappingBack(true);

				// Clear any existing timeout
				if (snapbackTimeoutRef.current) {
					clearTimeout(snapbackTimeoutRef.current);
				}

				// After delay, snap back to 100
				snapbackTimeoutRef.current = setTimeout(() => {
					setCreatorsCount(TRIAL_MAX_RESULTS);
					setIsSnappingBack(false);
					toast('Upgrade to unlock 500+ creators', { icon: '👑' });
				}, SNAPBACK_DELAY);
				return;
			}

			setCreatorsCount(value);
		},
		[isTrialUser]
	);

	if (!(isLoaded && user)) {
		return (
			<div className="rounded-lg text-card-foreground shadow-sm bg-zinc-900/80 border border-zinc-700/50">
				<div className="flex flex-col space-y-1.5 p-6">
					<div className="text-2xl font-semibold leading-none tracking-tight">
						Configure Keyword Search
					</div>
				</div>
				<div className="p-6 pt-0">
					<div className="flex justify-center items-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200"></div>
						<span className="ml-3 text-zinc-300">Loading...</span>
					</div>
				</div>
			</div>
		);
	}

	const handleSubmit = async (e) => {
		e.preventDefault();

		// Prevent double submission
		if (isLoading) {
			return;
		}

		setIsLoading(true);

		if (!selectedPlatform) {
			toast.error('Please select a platform (TikTok, Instagram, Enhanced Instagram, or YouTube)');
			setIsLoading(false);
			return;
		}

		try {
			const numericCreatorsCount = Number(creatorsCount);
			await onSubmit({
				platforms: [selectedPlatform],
				creatorsCount: numericCreatorsCount,
				scraperLimit: numericCreatorsCount,
				campaignId: campaignId,
			});
		} catch (_error) {
			// Error is handled by parent, just reset loading state
			setIsLoading(false);
		}
	};

	// V2 platform values
	const platformOptions = [
		{ value: 'tiktok', label: 'TikTok' },
		{ value: 'instagram', label: 'Instagram' },
		{ value: 'youtube', label: 'YouTube' },
	];

	const sliderMin = 100;
	const sliderMax = 1000;
	const sliderStep = 100;
	const sliderMarks = [100, 500, 1000];

	// Check if a mark is locked for trial users
	const isMarkLocked = (value) => isTrialUser && value > TRIAL_MAX_RESULTS;

	return (
		<div className="rounded-lg text-card-foreground shadow-sm bg-zinc-900/80 border border-zinc-700/50">
			<div className="flex flex-col space-y-1.5 p-6">
				<div className="text-2xl font-semibold leading-none tracking-tight">
					Configure Keyword Search
				</div>
			</div>
			<div className="p-6 pt-0">
				<form onSubmit={handleSubmit} className="space-y-8">
					{/* Platform Selection */}
					<div className="space-y-4">
						<label className="text-sm font-medium">Platform</label>
						<div className="flex flex-wrap gap-4">
							{platformOptions.map((platform) => {
								const isActive = selectedPlatform === platform.value;

								return (
									<div key={platform.value} className="flex items-center">
										<button
											type="button"
											role="checkbox"
											aria-checked={isActive}
											data-state={isActive ? 'checked' : 'unchecked'}
											value="on"
											onClick={() => setSelectedPlatform(platform.value)}
											className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
										>
											{isActive && (
												<span
													data-state="checked"
													className="flex items-center justify-center text-current pointer-events-none"
												>
													<Check className="h-4 w-4" />
												</span>
											)}
										</button>
										<input
											aria-hidden="true"
											tabIndex={-1}
											type="checkbox"
											className="sr-only"
											checked={isActive}
											readOnly
										/>
										<span className="ml-2 flex items-center gap-2">
											{platform.label}
											{platform.badge && (
												<span className="ml-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
													{platform.badge}
												</span>
											)}
										</span>
									</div>
								);
							})}
						</div>
					</div>

					{/* Creator Count Selection */}
					<div className="space-y-4">
						<label className="text-sm font-medium">How many creators do you need?</label>

						{/* Slider */}
						<Slider
							value={[creatorsCount]}
							onValueChange={handleSliderChange}
							min={sliderMin}
							max={sliderMax}
							step={sliderStep}
						/>

						{/* Labels below slider */}
						<div className="flex text-lg font-semibold">
							<span
								className={cn(
									'tabular-nums transition-all',
									creatorsCount === 100 ? 'text-white' : 'text-zinc-400'
								)}
							>
								100
							</span>
							<span
								className={cn(
									'flex items-center gap-1 tabular-nums mx-auto transition-all',
									creatorsCount === 500
										? isSnappingBack
											? 'text-amber-400 scale-110'
											: 'text-white'
										: 'text-zinc-500'
								)}
							>
								500
								{isTrialUser && <Crown className="h-4 w-4 text-amber-400" />}
							</span>
							<span
								className={cn(
									'flex items-center gap-1 tabular-nums transition-all',
									creatorsCount === 1000
										? isSnappingBack
											? 'text-amber-400 scale-110'
											: 'text-white'
										: 'text-zinc-500'
								)}
							>
								1,000
								{isTrialUser && <Crown className="h-4 w-4 text-amber-400" />}
							</span>
						</div>

						{/* Snap-back feedback message */}
						{isTrialUser && isSnappingBack && (
							<p className="text-xs text-amber-400 animate-pulse text-center">
								✨ Nice choice... but you need Pro!
							</p>
						)}
					</div>

					{/* Trial searches remaining - subtle inline */}
					{isTrialUser && !trialLoading && (
						<p className="text-xs text-zinc-500">
							Trial searches remaining:{' '}
							<span className="text-amber-400 font-medium">{searchesRemaining}/3</span>
						</p>
					)}

					<button
						type="submit"
						disabled={isLoading}
						className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
					>
						{isLoading ? 'Processing...' : 'Continue'}
					</button>
				</form>
			</div>
		</div>
	);
}
