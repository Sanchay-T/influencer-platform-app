import { isNumber, toRecord } from '@/lib/utils/type-guards';
import type { UiScrapingJob } from '../types/campaign-page';

const CACHE_PREFIX = 'campaignRunSnapshot:';

export type CachedRunSnapshot = {
	cachedAt: string;
	creatorBuffer: unknown[];
	totalCreators?: UiScrapingJob['totalCreators'];
	pagination?: UiScrapingJob['pagination'];
	pageLimit?: UiScrapingJob['pageLimit'];
};

export function readCachedRunSnapshot(jobId: string, maxAgeMs: number): CachedRunSnapshot | null {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}${jobId}`);
		if (!raw) {
			return null;
		}

		const parsed = toRecord(JSON.parse(raw));
		if (!parsed) {
			return null;
		}

		if (!Array.isArray(parsed.creatorBuffer)) {
			return null;
		}

		const cachedAt = typeof parsed.cachedAt === 'string' ? new Date(parsed.cachedAt) : null;
		if (!(cachedAt && Number.isFinite(cachedAt.getTime()))) {
			return null;
		}

		const ageMs = Date.now() - cachedAt.getTime();
		if (ageMs > maxAgeMs) {
			return null;
		}

		const paginationRecord = toRecord(parsed.pagination);
		const pagination = paginationRecord
			? {
					total: isNumber(paginationRecord.total) ? paginationRecord.total : undefined,
					limit: isNumber(paginationRecord.limit) ? paginationRecord.limit : undefined,
					nextOffset:
						isNumber(paginationRecord.nextOffset) || paginationRecord.nextOffset === null
							? paginationRecord.nextOffset
							: undefined,
				}
			: undefined;

		return {
			cachedAt: cachedAt.toISOString(),
			creatorBuffer: parsed.creatorBuffer,
			totalCreators: isNumber(parsed.totalCreators) ? parsed.totalCreators : undefined,
			pagination,
			pageLimit: isNumber(parsed.pageLimit) ? parsed.pageLimit : undefined,
		};
	} catch {
		return null;
	}
}

export function writeCachedRunSnapshot(jobId: string, snapshot: CachedRunSnapshot): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		window.sessionStorage.setItem(`${CACHE_PREFIX}${jobId}`, JSON.stringify(snapshot));
	} catch {
		// Ignore storage quota issues.
	}
}
