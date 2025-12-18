'use client';

import { useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Breadcrumbs from '@/app/components/breadcrumbs';
import { structuredConsole } from '@/lib/logging/console-proxy';
import KeywordReview from '../../../components/campaigns/keyword-search/keyword-review';
import KeywordSearchForm from '../../../components/campaigns/keyword-search/keyword-search-form';
import DashboardLayout from '../../../components/layout/dashboard-layout';

async function readResponsePayload(response) {
	const text = await response.text().catch(() => '');
	if (!text) {
		return { json: null, text: '' };
	}
	try {
		return { json: JSON.parse(text), text };
	} catch {
		return { json: null, text };
	}
}

export default function KeywordSearch() {
	const router = useRouter();
	const [step, setStep] = useState(1);
	const [searchData, setSearchData] = useState({
		platforms: [],
		creatorsCount: 1000,
		keywords: [],
		usernames: [],
		jobId: null,
		campaignId: null,
		selectedPlatform: null,
		targetUsernames: [],
		targetUsername: null,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [campaignName, setCampaignName] = useState('');

	useEffect(() => {
		let campaignResolved = false;

		try {
			const urlParams = new URLSearchParams(window.location.search);
			const campaignIdFromUrl = urlParams.get('campaignId');

			if (campaignIdFromUrl) {
				campaignResolved = true;
				setSearchData((prev) => ({
					...prev,
					campaignId: campaignIdFromUrl,
				}));
			}
		} catch (error) {
			structuredConsole.warn('[KeywordSearch] failed to parse URL params', error);
		}

		if (!campaignResolved) {
			try {
				const campaignData = sessionStorage.getItem('currentCampaign');
				if (campaignData) {
					const campaign = JSON.parse(campaignData);
					campaignResolved = true;
					setSearchData((prev) => ({
						...prev,
						campaignId: campaign.id,
					}));
					setCampaignName(campaign.name ?? '');
				}
			} catch (error) {
				structuredConsole.warn('[KeywordSearch] failed to parse campaign session storage', error);
			}
		}

		setIsLoading(false);
	}, []);

	useEffect(() => {
		if (searchData.campaignId && !campaignName) {
			try {
				const campaignData = JSON.parse(sessionStorage.getItem('currentCampaign') ?? 'null');
				if (campaignData?.name) {
					setCampaignName(campaignData.name);
				}
			} catch (error) {
				structuredConsole.warn('[KeywordSearch] failed to reload campaign info', error);
			}
		}
	}, [searchData.campaignId, campaignName]);

	// Manejar el paso 1: Selección de plataformas y número de creadores
	const handleFormSubmit = (data) => {
		setSearchData((prev) => ({
			...prev,
			platforms: data.platforms,
			creatorsCount: data.creatorsCount,
			scraperLimit: data.scraperLimit,
			campaignId: data.campaignId || prev.campaignId,
			selectedPlatform: data.platforms?.[0] || prev.selectedPlatform,
		}));
		setStep(2);
	};

	// Manejar el paso 2: Revisión y envío de keywords
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy flow; keep readable while improving error diagnostics.
	const handleKeywordsSubmit = async (payload) => {
		try {
			// Obtener el campaignId de searchData o del sessionStorage
			const campaignId =
				searchData.campaignId || JSON.parse(sessionStorage.getItem('currentCampaign'))?.id;

			if (!campaignId) {
				structuredConsole.warn('[KeywordSearch] no campaign ID found');
				throw new Error('Campaign not found');
			}

			const platformRaw = searchData.platforms?.[0] || searchData.selectedPlatform || '';
			const normalizedPlatform = typeof platformRaw === 'string' ? platformRaw.toLowerCase() : '';
			const submittedUsernames = Array.isArray(payload?.usernames)
				? payload.usernames
						.map((value) => (typeof value === 'string' ? value.trim() : ''))
						.filter((value) => value.length > 0)
				: [];
			const submittedKeywords = Array.isArray(payload?.keywords)
				? payload.keywords
						.map((value) => (typeof value === 'string' ? value.trim() : ''))
						.filter((value) => value.length > 0)
				: [];
			const hasUsernames = submittedUsernames.length > 0;

			// Map UI platform values to v2 API platform values
			const v2PlatformMap = new Map([
				['tiktok', 'tiktok'],
				['instagram', 'instagram'],
				['instagram_scrapecreators', 'instagram'],
				['youtube', 'youtube'],
			]);

			// Use V2 dispatch API for all keyword searches (not similar/username searches)
			const useV2 =
				!hasUsernames &&
				['tiktok', 'instagram', 'instagram_scrapecreators', 'youtube'].includes(normalizedPlatform);

			let response;
			if (useV2) {
				// V2 Fan-Out API - unified endpoint for all platforms
				const v2Platform = v2PlatformMap.get(normalizedPlatform) || 'tiktok';
				response = await fetch('/api/v2/dispatch', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						platform: v2Platform,
						keywords: submittedKeywords,
						targetResults: searchData.creatorsCount,
						campaignId: campaignId,
						enableExpansion: true,
					}),
				});
			} else {
				// Legacy API for similar/username searches
				let apiEndpoint = '/api/scraping/tiktok';
				if (
					hasUsernames ||
					normalizedPlatform === 'instagram-similar' ||
					normalizedPlatform === 'instagram_similar'
				) {
					apiEndpoint = '/api/scraping/instagram';
				}

				response = await fetch(apiEndpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						campaignId: campaignId,
						targetResults: searchData.creatorsCount,
						...(hasUsernames ? { usernames: submittedUsernames } : { keywords: submittedKeywords }),
					}),
				});
			}

			if (!response.ok) {
				const vercelId =
					response.headers.get('x-vercel-id') || response.headers.get('x-vercel-trace');
				const { json, text } = await readResponsePayload(response);
				const message =
					(json && (json.error || json.message)) ||
					(text ? text.slice(0, 200) : null) ||
					`HTTP ${response.status}`;

				structuredConsole.error('[KeywordSearch] start search failed (non-OK response)', {
					status: response.status,
					endpoint: response.url,
					vercelId,
					bodySnippet: text ? text.slice(0, 500) : null,
				});

				throw new Error(vercelId ? `${message} (Vercel: ${vercelId})` : message);
			}

			const vercelId =
				response.headers.get('x-vercel-id') || response.headers.get('x-vercel-trace');
			const { json, text } = await readResponsePayload(response);
			if (!json) {
				structuredConsole.error('[KeywordSearch] start search returned non-JSON response', {
					status: response.status,
					endpoint: response.url,
					vercelId,
					bodySnippet: text ? text.slice(0, 500) : null,
				});
				throw new Error(
					vercelId
						? `Server returned invalid response (Vercel: ${vercelId})`
						: 'Server returned invalid response'
				);
			}

			const data = json;

			// Map platform for results display
			const nextPlatform = (() => {
				if (hasUsernames) {
					return 'instagram-similar';
				}
				if (
					normalizedPlatform === 'instagram' ||
					normalizedPlatform === 'instagram_scrapecreators'
				) {
					return 'instagram';
				}
				if (normalizedPlatform === 'youtube') {
					return 'youtube';
				}
				return 'tiktok';
			})();

			setSearchData((prev) => ({
				...prev,
				keywords: hasUsernames ? [] : submittedKeywords,
				usernames: hasUsernames ? submittedUsernames : [],
				targetUsernames: hasUsernames ? submittedUsernames : [],
				targetUsername: hasUsernames ? submittedUsernames[0] || null : null,
				jobId: data.jobId,
				selectedPlatform: nextPlatform,
			}));
			toast.success('Campaign started successfully');
			router.push(`/campaigns/${campaignId}?jobId=${data.jobId}`);
		} catch (error) {
			structuredConsole.warn('[KeywordSearch] keyword submission failed', error);
			toast.error(error.message || 'Failed to start campaign');
		}
	};

	if (isLoading) {
		return (
			<DashboardLayout>
				<div className="py-8">
					<div className="flex justify-center items-center min-h-[300px]">
						<div className="text-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200 mb-4"></div>
							<p className="text-zinc-300">Loading campaign...</p>
						</div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="space-y-6">
				<Breadcrumbs
					items={[
						{ label: 'Dashboard', href: '/dashboard' },
						{
							label: campaignName || 'Campaign',
							href: searchData?.campaignId ? `/campaigns/${searchData.campaignId}` : '/dashboard',
							type: 'campaign',
						},
						{ label: 'Keyword Search' },
					]}
					backHref={
						searchData?.campaignId
							? `/campaigns/search?campaignId=${searchData.campaignId}`
							: '/campaigns/search'
					}
					backLabel="Back to Search Options"
				/>
				<div className="flex items-center justify-between mt-2">
					<div>
						<h1 className="text-2xl font-bold">Keyword Search</h1>
						<p className="text-sm text-zinc-400 mt-1">
							Discover creators using keywords across platforms
						</p>
					</div>
				</div>

				{step === 1 && <KeywordSearchForm onSubmit={handleFormSubmit} />}
				{step === 2 && (
					<KeywordReview
						onSubmit={handleKeywordsSubmit}
						isLoading={isLoading}
						platform={searchData?.selectedPlatform || searchData.platforms?.[0]}
					/>
				)}
			</div>
		</DashboardLayout>
	);
}
