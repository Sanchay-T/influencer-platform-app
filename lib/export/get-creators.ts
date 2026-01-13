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

export interface GetCreatorsResult {
	creators: any[];
	source: 'v2' | 'legacy';
}

/**
 * Fetch creators for given job IDs, trying V2 table first then legacy.
 */
export async function getCreatorsForJobs(jobIds: string[]): Promise<GetCreatorsResult> {
	if (jobIds.length === 0) {
		return { creators: [], source: 'v2' };
	}

	// Try V2 jobCreators table first
	const v2Creators = await db.query.jobCreators.findMany({
		where: inArray(jobCreators.jobId, jobIds),
	});

	if (v2Creators.length > 0) {
		structuredConsole.log(
			`CSV Export: Found ${v2Creators.length} creators in V2 jobCreators table`
		);
		return {
			creators: v2Creators.map((c) => c.creatorData),
			source: 'v2',
		};
	}

	// Fall back to legacy scrapingResults
	structuredConsole.log('CSV Export: No V2 creators found, checking legacy scrapingResults');
	const legacyResults = await db.query.scrapingResults.findMany({
		where: inArray(scrapingResults.jobId, jobIds),
	});

	let allCreators: any[] = [];
	for (const result of legacyResults) {
		const creatorsData = result.creators as any;
		if (Array.isArray(creatorsData)) {
			allCreators = allCreators.concat(creatorsData);
		} else if (creatorsData && typeof creatorsData === 'object') {
			if ('results' in creatorsData && Array.isArray(creatorsData.results)) {
				for (const r of creatorsData.results) {
					if (r.creators && Array.isArray(r.creators)) {
						allCreators = allCreators.concat(r.creators);
					}
				}
			} else {
				for (const key of Object.keys(creatorsData)) {
					if (Array.isArray(creatorsData[key])) {
						allCreators = allCreators.concat(creatorsData[key]);
					}
				}
			}
		}
	}

	return { creators: allCreators, source: 'legacy' };
}
