/**
 * Get Creators for Export
 *
 * @context Shared helper for CSV export - used by both the queue route
 * and the background worker. Supports both V2 (jobCreators table)
 * and legacy (scrapingResults JSON blob) storage.
 */

import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { jobCreators, scrapingResults } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { SentryLogger } from '@/lib/sentry';

export interface GetCreatorsResult {
	creators: unknown[];
	source: 'v2' | 'legacy';
}

/**
 * Fetch creators for given job IDs, trying V2 table first then legacy.
 */
export async function getCreatorsForJobs(jobIds: string[]): Promise<GetCreatorsResult> {
	if (jobIds.length === 0) {
		SentryLogger.addBreadcrumb({
			category: 'export',
			message: 'getCreatorsForJobs called with empty jobIds',
			level: 'warning',
		});
		return { creators: [], source: 'v2' };
	}

	SentryLogger.addBreadcrumb({
		category: 'export',
		message: 'Querying V2 jobCreators table',
		data: { jobCount: jobIds.length },
	});

	// Try V2 jobCreators table first
	const v2Creators = await db.query.jobCreators.findMany({
		where: inArray(jobCreators.jobId, jobIds),
	});

	if (v2Creators.length > 0) {
		structuredConsole.log(
			`CSV Export: Found ${v2Creators.length} creators in V2 jobCreators table`
		);
		SentryLogger.addBreadcrumb({
			category: 'export',
			message: 'Found creators in V2 table',
			data: { creatorCount: v2Creators.length, source: 'v2' },
		});
		return {
			creators: v2Creators.map((c) => c.creatorData),
			source: 'v2',
		};
	}

	// Fall back to legacy scrapingResults
	SentryLogger.addBreadcrumb({
		category: 'export',
		message: 'No V2 creators found, checking legacy scrapingResults',
	});
	structuredConsole.log('CSV Export: No V2 creators found, checking legacy scrapingResults');
	const legacyResults = await db.query.scrapingResults.findMany({
		where: inArray(scrapingResults.jobId, jobIds),
	});

	let allCreators: unknown[] = [];
	for (const result of legacyResults) {
		const creatorsData = result.creators as unknown;
		if (Array.isArray(creatorsData)) {
			allCreators = allCreators.concat(creatorsData);
		} else if (creatorsData && typeof creatorsData === 'object') {
			const creatorsRecord = creatorsData as Record<string, unknown>;
			if ('results' in creatorsRecord && Array.isArray(creatorsRecord.results)) {
				for (const r of creatorsRecord.results) {
					const resultRecord = r && typeof r === 'object' ? (r as Record<string, unknown>) : null;
					const creatorsList = resultRecord ? resultRecord.creators : undefined;
					if (Array.isArray(creatorsList)) {
						allCreators = allCreators.concat(creatorsList);
					}
				}
			} else {
				for (const key of Object.keys(creatorsRecord)) {
					const value = creatorsRecord[key];
					if (Array.isArray(value)) {
						allCreators = allCreators.concat(value);
					}
				}
			}
		}
	}

	SentryLogger.addBreadcrumb({
		category: 'export',
		message: 'Found creators in legacy table',
		data: { creatorCount: allCreators.length, source: 'legacy' },
	});

	return { creators: allCreators, source: 'legacy' };
}
