/**
 * Adaptive Re-Expansion Module
 *
 * Automatically detects when a job hasn't hit its target and dynamically
 * generates more keywords to fill the gap. This is the "self-healing" system
 * that adapts to different API yields without hardcoding per-platform values.
 *
 * Flow:
 * 1. All keywords complete → check if creatorsFound < targetResults
 * 2. Calculate actual yield: creatorsFound / keywordsCompleted
 * 3. Calculate shortfall: targetResults - creatorsFound
 * 4. Generate more keywords: shortfall / actualYield (with 1.3x buffer)
 * 5. Dispatch new search workers
 * 6. Repeat until target reached or max rounds (3)
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scrapingJobs } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { getDeadLetterQueueUrl, qstash } from '@/lib/queue/qstash';
import type { SearchWorkerMessage } from '../workers/types';
import { generateContinuationKeywords } from './ai-expansion';
import { PLATFORM_TIMEOUTS } from './config';
import type { Platform } from './types';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[adaptive-reexpand]';

/** Maximum number of re-expansion rounds */
const MAX_EXPANSION_ROUNDS = 3;

/** Maximum total keywords per job (safety limit) */
const MAX_TOTAL_KEYWORDS = 100;

/** Minimum yield per keyword before giving up (API is broken) */
const MIN_YIELD_PER_KEYWORD = 3;

/** Buffer multiplier for keyword calculation (request 30% more than needed) */
const KEYWORD_BUFFER = 1.3;

// ============================================================================
// Types
// ============================================================================

export interface ReexpansionResult {
	triggered: boolean;
	reason: string;
	newKeywordsDispatched?: number;
	expansionRound?: number;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Check if a job needs re-expansion and trigger it if so.
 * Called by search-worker after the last keyword completes.
 */
export async function checkAndReexpand(jobId: string): Promise<ReexpansionResult> {
	// Step 1: Get current job state
	const job = await db.query.scrapingJobs.findFirst({
		where: eq(scrapingJobs.id, jobId),
	});

	if (!job) {
		return { triggered: false, reason: 'Job not found' };
	}

	const {
		targetResults,
		creatorsFound,
		keywordsDispatched,
		keywordsCompleted,
		expansionRound,
		platform,
		keywords,
		usedKeywords,
		userId,
	} = job;

	const currentRound = expansionRound ?? 1;
	const found = creatorsFound ?? 0;
	const target = targetResults ?? 0;
	const dispatched = keywordsDispatched ?? 0;
	const completed = keywordsCompleted ?? 0;

	logger.info(
		`${LOG_PREFIX} Checking re-expansion`,
		{
			jobId,
			target,
			found,
			dispatched,
			completed,
			currentRound,
		},
		LogCategory.JOB
	);

	// Step 2: Check if all keywords are done
	if (completed < dispatched) {
		return { triggered: false, reason: 'Keywords still processing' };
	}

	// Step 3: Check if target already reached
	if (found >= target) {
		return { triggered: false, reason: 'Target already reached' };
	}

	// Step 4: Check expansion round limit
	if (currentRound >= MAX_EXPANSION_ROUNDS) {
		logger.warn(
			`${LOG_PREFIX} Max expansion rounds reached`,
			{ jobId, currentRound, found, target },
			LogCategory.JOB
		);
		return { triggered: false, reason: `Max rounds (${MAX_EXPANSION_ROUNDS}) reached` };
	}

	// Step 5: Calculate actual yield
	const actualYield = completed > 0 ? found / completed : 0;

	if (actualYield < MIN_YIELD_PER_KEYWORD) {
		logger.warn(
			`${LOG_PREFIX} Yield too low, API may be broken`,
			{ jobId, actualYield, minRequired: MIN_YIELD_PER_KEYWORD },
			LogCategory.JOB
		);
		return { triggered: false, reason: `Yield too low (${actualYield.toFixed(1)} per keyword)` };
	}

	// Step 6: Calculate how many more keywords we need
	const shortfall = target - found;
	const moreKeywordsNeeded = Math.ceil((shortfall / actualYield) * KEYWORD_BUFFER);

	// Check total keywords limit
	const currentTotalKeywords = Array.isArray(keywords) ? keywords.length : 0;
	const maxNewKeywords = MAX_TOTAL_KEYWORDS - currentTotalKeywords;

	if (maxNewKeywords <= 0) {
		return { triggered: false, reason: 'Max total keywords reached' };
	}

	const keywordsToGenerate = Math.min(moreKeywordsNeeded, maxNewKeywords, 30);

	logger.info(
		`${LOG_PREFIX} Re-expansion needed`,
		{
			jobId,
			shortfall,
			actualYield: actualYield.toFixed(2),
			moreKeywordsNeeded,
			keywordsToGenerate,
			newRound: currentRound + 1,
		},
		LogCategory.JOB
	);

	// Step 7: Generate new keywords
	const existingKeywords = Array.isArray(keywords) ? (keywords as string[]) : [];
	const allUsedKeywords = Array.isArray(usedKeywords)
		? (usedKeywords as string[])
		: existingKeywords;

	const newKeywords = await generateContinuationKeywords(
		existingKeywords.slice(0, 3), // Use first 3 original keywords as seeds
		allUsedKeywords,
		currentRound,
		keywordsToGenerate
	);

	if (newKeywords.length === 0) {
		logger.warn(`${LOG_PREFIX} AI couldn't generate more keywords`, { jobId }, LogCategory.JOB);
		return { triggered: false, reason: 'AI keyword generation exhausted' };
	}

	// Step 8: Update job with new keywords
	const updatedKeywords = [...existingKeywords, ...newKeywords];
	const updatedUsedKeywords = [...allUsedKeywords, ...newKeywords];

	await db
		.update(scrapingJobs)
		.set({
			keywords: updatedKeywords,
			usedKeywords: updatedUsedKeywords,
			keywordsDispatched: sql`COALESCE(${scrapingJobs.keywordsDispatched}, 0) + ${newKeywords.length}`,
			expansionRound: currentRound + 1,
			updatedAt: new Date(),
		})
		.where(eq(scrapingJobs.id, jobId));

	// Step 9: Dispatch new search workers via QStash
	const baseUrl = getWorkerBaseUrl();
	const searchWorkerUrl = `${baseUrl}/api/v2/worker/search`;
	const workerTimeoutSeconds = Math.ceil(
		(PLATFORM_TIMEOUTS[platform as Platform] || 120_000) / 1000
	);

	const dispatchPromises: Promise<unknown>[] = [];

	for (let i = 0; i < newKeywords.length; i++) {
		const keyword = newKeywords[i];
		const batchIndex = dispatched + i; // Continue indexing from where we left off

		const message: SearchWorkerMessage = {
			jobId,
			platform: platform as Platform,
			keyword,
			batchIndex,
			totalKeywords: updatedKeywords.length,
			userId,
			targetResults: target,
		};

		const publishPromise = qstash.publishJSON({
			url: searchWorkerUrl,
			body: message,
			retries: 3,
			delay: Math.floor(i / 5) * 1, // Stagger to prevent thundering herd
			timeout: workerTimeoutSeconds,
			failureCallback: getDeadLetterQueueUrl(),
		});

		dispatchPromises.push(publishPromise);
	}

	await Promise.allSettled(dispatchPromises);

	logger.info(
		`${LOG_PREFIX} Re-expansion dispatched`,
		{
			jobId,
			newKeywords: newKeywords.length,
			totalKeywords: updatedKeywords.length,
			newRound: currentRound + 1,
		},
		LogCategory.JOB
	);

	return {
		triggered: true,
		reason: `Dispatched ${newKeywords.length} new keywords (round ${currentRound + 1})`,
		newKeywordsDispatched: newKeywords.length,
		expansionRound: currentRound + 1,
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

function getWorkerBaseUrl(): string {
	if (process.env.V2_WORKER_URL) {
		return process.env.V2_WORKER_URL;
	}

	if (process.env.NODE_ENV === 'development' || process.env.NGROK_DOMAIN) {
		const ngrokDomain = process.env.NGROK_DOMAIN || 'usegemz.ngrok.app';
		return `https://${ngrokDomain}`;
	}

	return process.env.NEXT_PUBLIC_APP_URL || 'https://usegems.io';
}
