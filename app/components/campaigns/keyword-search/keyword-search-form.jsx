'use client';

import { useUser } from '@clerk/nextjs';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Slider } from '@/components/ui/slider';

export default function KeywordSearchForm({ onSubmit }) {
	const [selectedPlatform, setSelectedPlatform] = useState('tiktok');
	const [creatorsCount, setCreatorsCount] = useState(100);
	const [isLoading, setIsLoading] = useState(false);
	const [campaignId, setCampaignId] = useState(null);
	const { user, isLoaded } = useUser();

	useEffect(() => {
		// Obtener el campaignId de la URL si existe
		const urlParams = new URLSearchParams(window.location.search);
		const urlCampaignId = urlParams.get('campaignId');
		if (urlCampaignId) {
			setCampaignId(urlCampaignId);
		}
	}, []);

	useEffect(() => {
		if (creatorsCount < 100) {
			setCreatorsCount(100);
		}
	}, [creatorsCount]);

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

	const getActualScraperLimit = (uiValue) => {
		// Retornamos el valor real del slider (1000-5000)
		return uiValue;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);

		if (!selectedPlatform) {
			toast.error('Please select a platform (TikTok, Instagram, Enhanced Instagram, or YouTube)');
			setIsLoading(false);
			return;
		}

		// Asegurarnos de que creatorsCount sea un número
		const numericCreatorsCount = Number(creatorsCount);
		// Pasar el campaignId si existe
		onSubmit({
			platforms: [selectedPlatform],
			creatorsCount: numericCreatorsCount,
			scraperLimit: numericCreatorsCount, // Usamos el valor numérico
			campaignId: campaignId,
		});
		setIsLoading(false);
	};

	const getCreditsUsed = (count) => count / 100; // 1000 creators = 10 credits, etc.

	const platformOptions = [
		{ value: 'tiktok', label: 'TikTok' },
		{ value: 'instagram_scrapecreators', label: 'Instagram' },
		{ value: 'youtube', label: 'YouTube' },
	];
	const sliderMin = 100;
	const sliderMax = 1000;
	const sliderStep = 100;
	const sliderMarks = [100, 500, 1000];

	return (
		<div className="rounded-lg text-card-foreground shadow-sm bg-zinc-900/80 border border-zinc-700/50">
			<div className="flex flex-col space-y-1.5 p-6">
				<div className="text-2xl font-semibold leading-none tracking-tight">
					Configure Keyword Search
				</div>
			</div>
			<div className="p-6 pt-0">
				<form onSubmit={handleSubmit} className="space-y-8">
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

					<div className="space-y-4">
						<label className="text-sm font-medium">How many creators do you need?</label>
						<Slider
							value={[creatorsCount]}
							onValueChange={([value]) => setCreatorsCount(value)}
							min={sliderMin}
							max={sliderMax}
							step={sliderStep}
							className="py-4"
						/>
						<div className="flex justify-between text-md text-muted-foreground">
							{sliderMarks.map((value) => (
								<span key={value} className={creatorsCount === value ? 'font-black' : ''}>
									{value.toLocaleString('en-US')}
								</span>
							))}
						</div>
						<div className="text-sm text-muted-foreground">
							This will use {getCreditsUsed(creatorsCount)} of your 50 credits
						</div>
					</div>

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
