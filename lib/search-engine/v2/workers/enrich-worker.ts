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
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { isString, toRecord } from '@/lib/utils/type-guards';
import { getAdapter } from '../adapters/interface';
// Side-effect imports: register adapters with the registry
import '../adapters/instagram';
import '../adapters/tiktok';
import '../adapters/youtube';
import { buildConfig, EMAIL_REGEX } from '../core/config';
import { loadJobTracker } from '../core/job-tracker';
import type { NormalizedCreator } from '../core/types';
import type { EnrichWorkerMessage, EnrichWorkerResult } from './types';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[v2-enrich-worker]';

// Parallel enrichment limit (ScrapeCreators has no rate limits)
const MAX_PARALLEL_ENRICHMENTS = 5;

const isNormalizedCreator = (value: unknown): value is NormalizedCreator => {
	const record = toRecord(value);
	if (!record) {
		return false;
	}
	return (
		isString(record.id) &&
		isString(record.mergeKey) &&
		isString(record.platform) &&
		toRecord(record.creator) !== null &&
		toRecord(record.content) !== null &&
		Array.isArray(record.hashtags)
	);
};

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

	// Set Sentry context for this enrichment worker
	SentryLogger.setContext('enrich_worker', {
		jobId,
		platform,
		batchIndex,
		totalBatches,
		creatorCount: creatorIds.length,
		userId,
	});

	// Add breadcrumb for enrichment start
	SentryLogger.addBreadcrumb({
		category: 'enrichment',
		message: `Starting enrichment batch ${batchIndex + 1}/${totalBatches}`,
		level: 'info',
		data: { jobId, platform, creatorCount: creatorIds.length },
	});

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

	// Wrap entire worker in a Sentry span for automatic duration tracking
	return SentryLogger.startSpanAsync(
		{
			name: 'enrich.worker',
			op: 'worker',
			attributes: {
				jobId,
				platform,
				batchIndex,
				totalBatches,
				creatorCount: creatorIds.length,
			},
		},
		async () => {
			const startTime = Date.now();
			try {
				// ========================================================================
				// Step 1: Get Platform Adapter
				// ========================================================================

				const adapter = getAdapter(platform);
				const config = buildConfig(platform);

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

				// Filter to only non-enriched creators (use column, not JSON)
				// @why The `enriched` column is indexed and faster than JSON extraction
				const creatorsToEnrich = creatorRows.filter((row) => !row.enriched);

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
				// Step 3: Enrich Creators in Parallel (with Sentry span)
				// ========================================================================

				const { enrichedResults, emailsFound } = await SentryLogger.startSpanAsync(
					{
						name: 'enrich.batch',
						op: 'task',
						attributes: { jobId, platform, creatorsToEnrich: creatorsToEnrich.length },
					},
					async () => {
						const results: Array<{
							row: (typeof creatorRows)[0];
							enriched: NormalizedCreator | null;
						}> = [];
						let emailCount = 0;

						// Process in parallel batches
						for (let i = 0; i < creatorsToEnrich.length; i += MAX_PARALLEL_ENRICHMENTS) {
							const batch = creatorsToEnrich.slice(i, i + MAX_PARALLEL_ENRICHMENTS);
							const batchNum = Math.floor(i / MAX_PARALLEL_ENRICHMENTS) + 1;
							const totalBatchesInner = Math.ceil(
								creatorsToEnrich.length / MAX_PARALLEL_ENRICHMENTS
							);

							// Add breadcrumb for progress through creators
							SentryLogger.addBreadcrumb({
								category: 'enrichment',
								message: `Processing enrichment mini-batch ${batchNum}/${totalBatchesInner}`,
								level: 'info',
								data: { jobId, processed: i, total: creatorsToEnrich.length },
							});

							const enrichPromises = batch.map(async (row) => {
								const creator = isNormalizedCreator(row.creatorData) ? row.creatorData : null;
								if (!creator) {
									logger.warn(
										`${LOG_PREFIX} Invalid creator data in job_creators row`,
										{ jobId, rowId: row.id },
										LogCategory.JOB
									);
									return { row, enriched: null };
								}
								try {
									const enriched = await adapter.enrich?.(creator, config);
									if (!enriched) {
										return { row, enriched: null };
									}

									// Extract emails from enriched bio (skip truncated bios)
									if (enriched.bioEnriched && enriched.creator.bio) {
										const emails = enriched.creator.bio.match(EMAIL_REGEX) ?? [];
										if (emails.length > 0) {
											enriched.creator.emails = [
												...new Set([...enriched.creator.emails, ...emails]),
											];
											emailCount += emails.length;
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
										},
									};
								}
							});

							const batchResults = await Promise.all(enrichPromises);
							results.push(...batchResults);
						}

						return { enrichedResults: results, emailsFound: emailCount };
					}
				);

				// ========================================================================
				// Step 4: Update Creator Rows in DB
				// ========================================================================

				// Update each row individually (no transaction needed - each is atomic)
				// @why Set both `creatorData` (JSON) and `enriched` column for completion queries
				for (const { row, enriched } of enrichedResults) {
					await db
						.update(jobCreators)
						.set({ creatorData: enriched ?? row.creatorData, enriched: true })
						.where(eq(jobCreators.id, row.id));
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

				// Add success breadcrumb
				SentryLogger.addBreadcrumb({
					category: 'enrichment',
					message: `Enrichment batch ${batchIndex + 1}/${totalBatches} complete`,
					level: 'info',
					data: {
						jobId,
						creatorsEnriched: enrichedResults.length,
						emailsFound,
						allDone,
						durationMs,
					},
				});

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

				// Capture error in Sentry with enrichment context
				SentryLogger.captureException(error, {
					tags: {
						feature: 'enrichment',
						platform,
						stage: 'batch_process',
					},
					extra: {
						jobId,
						batchIndex,
						totalBatches,
						creatorCount: creatorIds.length,
						durationMs,
					},
				});

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
	);
}
