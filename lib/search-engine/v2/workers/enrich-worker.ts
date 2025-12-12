/**
 * V2 Enrich Worker - Bio Enrichment for Creator Batches
 *
 * This worker handles bio enrichment for a batch of creators:
 * 1. Receives batch of creator IDs from QStash
 * 2. Loads creators from DB
 * 3. Enriches each with full bio from profile API
 * 4. Extracts emails from enriched bios
 * 5. Updates creators in DB
 * 6. Updates job counters atomically
 * 7. Marks job complete when all batches done
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scrapingResults } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { getAdapter } from '../adapters/interface';
// Side-effect imports: register adapters with the registry
import '../adapters/instagram';
import '../adapters/tiktok';
import '../adapters/youtube';
import { buildConfig, EMAIL_REGEX } from '../core/config';
import { loadJobTracker } from '../core/job-tracker';
import type { NormalizedCreator, Platform } from '../core/types';
import type { EnrichWorkerMessage, EnrichWorkerResult } from './types';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[v2-enrich-worker]';

// Parallel enrichment limit (ScrapeCreators has no rate limits)
const MAX_PARALLEL_ENRICHMENTS = 5;

// ============================================================================
// Main Worker Function
// ============================================================================

export interface ProcessEnrichOptions {
	message: EnrichWorkerMessage;
}

/**
 * Process a batch of creators for enrichment
 * Called by the /api/v2/worker/enrich route
 */
export async function processEnrich(options: ProcessEnrichOptions): Promise<EnrichWorkerResult> {
	const { message } = options;
	const { jobId, platform, creatorIds, batchIndex, totalBatches, userId } = message;

	const startTime = Date.now();

	logger.info(
		`${LOG_PREFIX} Processing enrichment batch`,
		{
			jobId,
			platform,
			batchIndex,
			totalBatches,
			creatorCount: creatorIds.length,
		},
		LogCategory.JOB
	);

	try {
		// ========================================================================
		// Step 1: Get Platform Adapter
		// ========================================================================

		const adapter = getAdapter(platform as Platform);
		const config = buildConfig(platform as Platform);

		// Check if adapter supports enrichment
		if (!adapter.enrich) {
			logger.info(
				`${LOG_PREFIX} Platform ${platform} does not support enrichment, skipping`,
				{ jobId, batchIndex },
				LogCategory.JOB
			);

			// Still update counters
			const tracker = loadJobTracker(jobId);
			await tracker.addCreatorsEnriched(creatorIds.length);
			await tracker.updateProgressPercentage();
			await tracker.checkAndComplete();

			return {
				creatorsEnriched: creatorIds.length,
				emailsFound: 0,
				durationMs: Date.now() - startTime,
			};
		}

		// ========================================================================
		// Step 2: Load Creators from DB
		// ========================================================================

		const [existing] = await db
			.select()
			.from(scrapingResults)
			.where(eq(scrapingResults.jobId, jobId))
			.limit(1);

		if (!(existing && Array.isArray(existing.creators))) {
			logger.warn(`${LOG_PREFIX} No results found for job`, { jobId, batchIndex }, LogCategory.JOB);

			return {
				creatorsEnriched: 0,
				emailsFound: 0,
				durationMs: Date.now() - startTime,
				error: 'No results found for job',
			};
		}

		const allCreators = existing.creators as NormalizedCreator[];

		// Find creators that need enrichment from this batch
		const creatorsToEnrich = allCreators.filter((c) => {
			const creatorKey = c.creator.username || c.creator.uniqueId || c.id;
			return creatorIds.includes(creatorKey) && !c.bioEnriched;
		});

		if (creatorsToEnrich.length === 0) {
			logger.info(
				`${LOG_PREFIX} No creators need enrichment in this batch`,
				{ jobId, batchIndex },
				LogCategory.JOB
			);

			// Still update counters
			const tracker = loadJobTracker(jobId);
			await tracker.addCreatorsEnriched(creatorIds.length);
			await tracker.updateProgressPercentage();
			await tracker.checkAndComplete();

			return {
				creatorsEnriched: 0,
				emailsFound: 0,
				durationMs: Date.now() - startTime,
			};
		}

		// ========================================================================
		// Step 3: Enrich Creators in Parallel
		// ========================================================================

		const enrichedCreators: Map<string, NormalizedCreator> = new Map();
		let emailsFound = 0;

		// Process in parallel batches
		for (let i = 0; i < creatorsToEnrich.length; i += MAX_PARALLEL_ENRICHMENTS) {
			const batch = creatorsToEnrich.slice(i, i + MAX_PARALLEL_ENRICHMENTS);

			const enrichPromises = batch.map(async (creator) => {
				try {
					const enriched = await adapter.enrich!(creator, config);

					// Extract emails from enriched bio (skip truncated bios)
					if (enriched.bioEnriched && enriched.creator.bio) {
						const emails = enriched.creator.bio.match(EMAIL_REGEX) ?? [];
						if (emails.length > 0) {
							enriched.creator.emails = [...new Set([...enriched.creator.emails, ...emails])];
							emailsFound += emails.length;
						}
					}

					return enriched;
				} catch (error) {
					logger.warn(
						`${LOG_PREFIX} Enrichment failed for creator`,
						{
							jobId,
							creator: creator.creator.username,
							error: error instanceof Error ? error.message : String(error),
						},
						LogCategory.JOB
					);
					// Mark as enriched even on failure (so we don't retry forever)
					return {
						...creator,
						bioEnriched: true,
						bioEnrichedAt: new Date().toISOString(),
					};
				}
			});

			const results = await Promise.all(enrichPromises);

			for (const enriched of results) {
				const key = enriched.creator.username || enriched.creator.uniqueId || enriched.id;
				enrichedCreators.set(key, enriched);
			}
		}

		// ========================================================================
		// Step 4: Update Creators in DB
		// ========================================================================

		await db.transaction(async (tx) => {
			// Re-fetch to get latest state (another worker might have updated)
			const [current] = await tx
				.select()
				.from(scrapingResults)
				.where(eq(scrapingResults.jobId, jobId))
				.limit(1);

			if (!(current && Array.isArray(current.creators))) {
				return;
			}

			const currentCreators = current.creators as NormalizedCreator[];

			// Merge enriched creators back
			const updatedCreators = currentCreators.map((c) => {
				const key = c.creator.username || c.creator.uniqueId || c.id;
				const enriched = enrichedCreators.get(key);
				return enriched ?? c;
			});

			await tx
				.update(scrapingResults)
				.set({ creators: updatedCreators })
				.where(eq(scrapingResults.id, current.id));
		});

		// ========================================================================
		// Step 5: Update Job Counters
		// ========================================================================

		const tracker = loadJobTracker(jobId);
		const { allDone } = await tracker.addCreatorsEnriched(enrichedCreators.size);
		await tracker.updateProgressPercentage();

		// Check if all enrichment is complete
		if (allDone) {
			await tracker.checkAndComplete();
		}

		const durationMs = Date.now() - startTime;

		logger.info(
			`${LOG_PREFIX} Enrichment batch complete`,
			{
				jobId,
				batchIndex,
				creatorsEnriched: enrichedCreators.size,
				emailsFound,
				allDone,
				durationMs,
			},
			LogCategory.JOB
		);

		return {
			creatorsEnriched: enrichedCreators.size,
			emailsFound,
			durationMs,
		};
	} catch (error) {
		const durationMs = Date.now() - startTime;

		logger.error(
			`${LOG_PREFIX} Enrichment batch failed`,
			error instanceof Error ? error : new Error(String(error)),
			{
				jobId,
				batchIndex,
				durationMs,
			},
			LogCategory.JOB
		);

		// Still increment counter so job can eventually complete
		try {
			const tracker = loadJobTracker(jobId);
			await tracker.addCreatorsEnriched(creatorIds.length);
			await tracker.updateProgressPercentage();
			await tracker.checkAndComplete();
		} catch {
			// Ignore tracker errors
		}

		return {
			creatorsEnriched: 0,
			emailsFound: 0,
			durationMs,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
