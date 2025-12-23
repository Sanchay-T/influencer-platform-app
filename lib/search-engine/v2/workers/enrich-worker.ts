/**
 * V2 Enrich Worker - Bio Enrichment for Creator Batches
 *
 * This worker handles bio enrichment for a batch of creators:
 * 1. Receives batch of creator IDs from QStash
 * 2. Loads creators from job_creators table
 * 3. Enriches each with full bio from profile API
 * 4. Extracts emails from enriched bios
 * 5. Updates creator rows in DB
 * 6. Updates job counters atomically
 * 7. Marks job complete when all batches done
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { jobCreators } from '@/lib/db/schema';
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
		// Step 2: Load Creators from job_creators table
		// ========================================================================

		const creatorRows = await db
			.select()
			.from(jobCreators)
			.where(
				and(
					eq(jobCreators.jobId, jobId),
					inArray(
						jobCreators.username,
						creatorIds.map((id) => id.toLowerCase().trim())
					)
				)
			);

		if (creatorRows.length === 0) {
			logger.warn(
				`${LOG_PREFIX} No creators found for batch`,
				{ jobId, batchIndex, creatorIds: creatorIds.slice(0, 5) },
				LogCategory.JOB
			);

			return {
				creatorsEnriched: 0,
				emailsFound: 0,
				durationMs: Date.now() - startTime,
				error: 'No creators found for batch',
			};
		}

		// Filter to only non-enriched creators
		const creatorsToEnrich = creatorRows.filter((row) => {
			const creator = row.creatorData as NormalizedCreator;
			return !creator.bioEnriched;
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

		const enrichedResults: Array<{ row: (typeof creatorRows)[0]; enriched: NormalizedCreator }> =
			[];
		let emailsFound = 0;

		// Process in parallel batches
		for (let i = 0; i < creatorsToEnrich.length; i += MAX_PARALLEL_ENRICHMENTS) {
			const batch = creatorsToEnrich.slice(i, i + MAX_PARALLEL_ENRICHMENTS);

			const enrichPromises = batch.map(async (row) => {
				const creator = row.creatorData as NormalizedCreator;
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

					return { row, enriched };
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
						row,
						enriched: {
							...creator,
							bioEnriched: true,
							bioEnrichedAt: new Date().toISOString(),
						} as NormalizedCreator,
					};
				}
			});

			const results = await Promise.all(enrichPromises);
			enrichedResults.push(...results);
		}

		// ========================================================================
		// Step 4: Update Creator Rows in DB
		// ========================================================================

		// Update each row individually (no transaction needed - each is atomic)
		for (const { row, enriched } of enrichedResults) {
			await db.update(jobCreators).set({ creatorData: enriched }).where(eq(jobCreators.id, row.id));
		}

		// ========================================================================
		// Step 5: Update Job Counters
		// ========================================================================

		const tracker = loadJobTracker(jobId);
		const { allDone } = await tracker.addCreatorsEnriched(enrichedResults.length);
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
				creatorsEnriched: enrichedResults.length,
				emailsFound,
				allDone,
				durationMs,
			},
			LogCategory.JOB
		);

		return {
			creatorsEnriched: enrichedResults.length,
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
