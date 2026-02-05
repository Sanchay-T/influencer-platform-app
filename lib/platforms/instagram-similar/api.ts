import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * Instagram Similar Creator Search API Integration (Apify)
 */

import { ApifyClient } from 'apify-client';
import { APIFY_COST_PER_CU_USD, APIFY_COST_PER_RESULT_USD } from '@/lib/cost/constants';
import {
	getNumberProperty,
	isBoolean,
	isNumber,
	isString,
	toRecord,
} from '@/lib/utils/type-guards';
import type {
	ApifyInstagramProfileResponse,
	ApifyRelatedProfile,
	InstagramSimilarSearchResult,
} from './types';

// Initialize Apify client
const getApifyClient = () => {
	const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
	if (!token) {
		throw new Error('APIFY_TOKEN or APIFY_API_TOKEN environment variable is not set');
	}
	return new ApifyClient({ token });
};

// Instagram Profile Scraper Actor ID (from test outputs)
const INSTAGRAM_PROFILE_ACTOR_ID = process.env.INSTAGRAM_SCRAPER_ACTOR_ID || 'dSCLg0C3YEZ83HzYX';

const toRelatedProfile = (value: unknown): ApifyRelatedProfile | null => {
	const record = toRecord(value);
	if (!record) {
		return null;
	}
	if (!(isString(record.id) && isString(record.username) && isString(record.full_name))) {
		return null;
	}
	if (!isString(record.profile_pic_url)) {
		return null;
	}
	if (!(isBoolean(record.is_private) && isBoolean(record.is_verified))) {
		return null;
	}

	return {
		id: record.id,
		username: record.username,
		full_name: record.full_name,
		is_private: record.is_private,
		is_verified: record.is_verified,
		profile_pic_url: record.profile_pic_url,
		follower_count: isNumber(record.follower_count) ? record.follower_count : undefined,
		followers: isNumber(record.followers) ? record.followers : undefined,
		followers_count: isNumber(record.followers_count) ? record.followers_count : undefined,
	};
};

const toInstagramProfileResponse = (value: unknown): ApifyInstagramProfileResponse | null => {
	const record = toRecord(value);
	if (!record) {
		return null;
	}

	const relatedProfiles = Array.isArray(record.relatedProfiles)
		? record.relatedProfiles
				.map(toRelatedProfile)
				.filter((item): item is ApifyRelatedProfile => item !== null)
		: [];

	if (
		!(
			isString(record.inputUrl) &&
			isString(record.id) &&
			isString(record.username) &&
			isString(record.url) &&
			isString(record.fullName) &&
			isString(record.biography) &&
			isNumber(record.followersCount) &&
			isNumber(record.followsCount) &&
			isBoolean(record.hasChannel) &&
			isNumber(record.highlightReelCount) &&
			isBoolean(record.isBusinessAccount) &&
			isBoolean(record.joinedRecently) &&
			isBoolean(record.private) &&
			isBoolean(record.verified) &&
			isString(record.profilePicUrl) &&
			isString(record.profilePicUrlHD) &&
			isNumber(record.igtvVideoCount)
		)
	) {
		return null;
	}

	return {
		inputUrl: record.inputUrl,
		id: record.id,
		username: record.username,
		url: record.url,
		fullName: record.fullName,
		biography: record.biography,
		externalUrl: isString(record.externalUrl) ? record.externalUrl : undefined,
		externalUrls: Array.isArray(record.externalUrls)
			? record.externalUrls.filter((item) => toRecord(item) !== null)
			: undefined,
		followersCount: record.followersCount,
		followsCount: record.followsCount,
		hasChannel: record.hasChannel,
		highlightReelCount: record.highlightReelCount,
		isBusinessAccount: record.isBusinessAccount,
		joinedRecently: record.joinedRecently,
		businessCategoryName: isString(record.businessCategoryName)
			? record.businessCategoryName
			: undefined,
		private: record.private,
		verified: record.verified,
		profilePicUrl: record.profilePicUrl,
		profilePicUrlHD: record.profilePicUrlHD,
		igtvVideoCount: record.igtvVideoCount,
		relatedProfiles,
		postsCount: isNumber(record.postsCount) ? record.postsCount : undefined,
		latestIgtvVideos: Array.isArray(record.latestIgtvVideos) ? record.latestIgtvVideos : undefined,
		latestPosts: Array.isArray(record.latestPosts) ? record.latestPosts : undefined,
		following: Array.isArray(record.following) ? record.following : undefined,
		followers: Array.isArray(record.followers) ? record.followers : undefined,
		similarAccounts: Array.isArray(record.similarAccounts) ? record.similarAccounts : undefined,
	};
};

/**
 * Get Instagram profile data including related profiles using Apify
 */
export async function getInstagramProfile(username: string): Promise<InstagramSimilarSearchResult> {
	structuredConsole.log(`📱 [INSTAGRAM-API] Fetching profile for @${username}`);

	try {
		const client = getApifyClient();

		// Prepare the input for the actor (based on Apify Instagram Profile Scraper requirements)
		const input = {
			usernames: [username], // Array of usernames without @ symbol
			resultsType: 'details',
			resultsLimit: 100, // Get up to 100 related profiles
			searchType: 'user',
			searchLimit: 1,
			addParentData: false,
		};

		structuredConsole.log(
			'🚀 [INSTAGRAM-API] Starting Apify actor run with input:',
			JSON.stringify(input, null, 2)
		);

		// Start the actor run
		const run = await client.actor(INSTAGRAM_PROFILE_ACTOR_ID).call(input);

		structuredConsole.log('⏳ [INSTAGRAM-API] Actor run started, ID:', run.id);
		structuredConsole.log('📊 [INSTAGRAM-API] Run status:', run.status);

		// Wait for the run to finish (with timeout)
		const maxWaitTime = 60000; // 60 seconds timeout
		const startTime = Date.now();
		let finalRun = run;

		while (finalRun.status !== 'SUCCEEDED' && finalRun.status !== 'FAILED') {
			if (Date.now() - startTime > maxWaitTime) {
				throw new Error(`Apify run timed out after ${maxWaitTime}ms`);
			}

			await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
			const fetchedRun = await client.run(run.id).get();
			if (!fetchedRun) {
				throw new Error('Apify run not found while polling');
			}
			finalRun = fetchedRun;
			structuredConsole.log('⏳ [INSTAGRAM-API] Checking run status:', finalRun.status);
		}

		if (finalRun.status === 'FAILED') {
			throw new Error(`Apify run failed: ${finalRun.statusMessage}`);
		}

		structuredConsole.log('✅ [INSTAGRAM-API] Run completed successfully');

		// Get the results from the dataset
		const dataset = await client.dataset(finalRun.defaultDatasetId).listItems();
		const items = dataset.items || [];
		const stats = toRecord(finalRun.stats);
		const pricingInfo = toRecord(finalRun.pricingInfo);
		const computeUnits = stats ? (getNumberProperty(stats, 'computeUnits') ?? 0) : 0;
		const pricePerResult =
			(pricingInfo ? getNumberProperty(pricingInfo, 'pricePerUnitUsd') : null) ??
			APIFY_COST_PER_RESULT_USD;
		const totalCostUsd = computeUnits * APIFY_COST_PER_CU_USD + items.length * pricePerResult;

		if (!items || items.length === 0) {
			throw new Error('No data returned from Apify');
		}

		const profileData = toInstagramProfileResponse(items[0]);
		if (!profileData) {
			throw new Error('Invalid profile data returned from Apify');
		}

		structuredConsole.log('📊 [INSTAGRAM-API] Profile data retrieved:', {
			username: profileData.username,
			fullName: profileData.fullName,
			followersCount: profileData.followersCount,
			relatedProfilesCount: profileData.relatedProfiles?.length || 0,
			verified: profileData.verified,
			isBusinessAccount: profileData.isBusinessAccount,
		});

		return {
			success: true,
			data: profileData,
			cost: {
				computeUnits,
				results: items.length,
				totalCostUsd,
				pricePerResultUsd: pricePerResult,
				pricePerComputeUnitUsd: APIFY_COST_PER_CU_USD,
			},
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		structuredConsole.error('❌ [INSTAGRAM-API] Error fetching profile:', message);
		return {
			success: false,
			error: message || 'Failed to fetch Instagram profile',
		};
	}
}

/**
 * Get enhanced Instagram profile data (with bio) using Apify
 */
export async function getEnhancedInstagramProfile(
	username: string
): Promise<InstagramSimilarSearchResult> {
	structuredConsole.log(`📱 [INSTAGRAM-ENHANCED] Fetching enhanced profile for @${username}`);

	try {
		const client = getApifyClient();

		// Use the same actor but optimized for single profile with bio
		const input = {
			usernames: [username],
			resultsType: 'details',
			resultsLimit: 1,
			searchType: 'user',
			searchLimit: 1,
			addParentData: false,
		};

		structuredConsole.log('🚀 [INSTAGRAM-ENHANCED] Starting enhanced profile fetch');

		const run = await client.actor(INSTAGRAM_PROFILE_ACTOR_ID).call(input);

		// Wait for completion (shorter timeout for single profile)
		const maxWaitTime = 30000; // 30 seconds
		const startTime = Date.now();
		let finalRun = run;

		while (finalRun.status !== 'SUCCEEDED' && finalRun.status !== 'FAILED') {
			if (Date.now() - startTime > maxWaitTime) {
				throw new Error(`Enhanced profile fetch timed out after ${maxWaitTime}ms`);
			}

			await new Promise((resolve) => setTimeout(resolve, 1000));
			const fetchedRun = await client.run(run.id).get();
			if (!fetchedRun) {
				throw new Error('Enhanced Apify run not found while polling');
			}
			finalRun = fetchedRun;
		}

		if (finalRun.status === 'FAILED') {
			throw new Error(`Enhanced profile fetch failed: ${finalRun.statusMessage}`);
		}

		const dataset = await client.dataset(finalRun.defaultDatasetId).listItems();
		const items = dataset.items || [];
		const stats = toRecord(finalRun.stats);
		const pricingInfo = toRecord(finalRun.pricingInfo);
		const computeUnits = stats ? (getNumberProperty(stats, 'computeUnits') ?? 0) : 0;
		const pricePerResult =
			(pricingInfo ? getNumberProperty(pricingInfo, 'pricePerUnitUsd') : null) ??
			APIFY_COST_PER_RESULT_USD;
		const totalCostUsd = computeUnits * APIFY_COST_PER_CU_USD + items.length * pricePerResult;

		if (!items || items.length === 0) {
			throw new Error('No enhanced profile data returned');
		}

		const profileData = toInstagramProfileResponse(items[0]);
		if (!profileData) {
			throw new Error('Invalid enhanced profile data returned');
		}

		structuredConsole.log('📊 [INSTAGRAM-ENHANCED] Enhanced profile retrieved:', {
			username: profileData.username,
			biography: `${profileData.biography?.substring(0, 100)}...`,
			followersCount: profileData.followersCount,
		});

		return {
			success: true,
			data: profileData,
			cost: {
				computeUnits,
				results: items.length,
				totalCostUsd,
				pricePerResultUsd: pricePerResult,
				pricePerComputeUnitUsd: APIFY_COST_PER_CU_USD,
			},
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		structuredConsole.error('❌ [INSTAGRAM-ENHANCED] Error fetching enhanced profile:', message);
		return {
			success: false,
			error: message || 'Failed to fetch enhanced Instagram profile',
		};
	}
}

/**
 * Extract emails from Instagram bio text (same as TikTok pattern)
 */
export function extractEmailsFromBio(bio: string): string[] {
	if (!bio) {
		return [];
	}

	const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
	const extractedEmails = bio.match(emailRegex) || [];

	structuredConsole.log('📧 [INSTAGRAM-EMAIL] Email extraction:', {
		bioInput: `${bio.substring(0, 100)}...`,
		emailsFound: extractedEmails,
		emailCount: extractedEmails.length,
	});

	return extractedEmails;
}

/**
 * Extract and validate Instagram username from various input formats
 */
export function extractUsername(input: string): string {
	// Remove @ symbol if present
	let username = input.replace('@', '');

	// Extract username from Instagram URL if provided
	const urlMatch = username.match(/instagram\.com\/([^/?]+)/);
	if (urlMatch) {
		username = urlMatch[1];
	}

	// Remove any trailing slashes or query parameters
	username = username.split('/')[0].split('?')[0];

	// Validate username (Instagram usernames can only contain letters, numbers, periods, and underscores)
	if (!/^[a-zA-Z0-9._]+$/.test(username)) {
		throw new Error(`Invalid Instagram username: ${username}`);
	}

	return username;
}
