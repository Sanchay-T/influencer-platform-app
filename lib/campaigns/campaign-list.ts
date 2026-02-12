import type { CampaignStatus } from '@/lib/db/schema';

export type CampaignListSort = 'newest' | 'updated' | 'alpha';
export type CampaignListStatusFilter = CampaignStatus | 'all';

export type CampaignListParams = {
	page: number;
	limit: number;
	status: CampaignListStatusFilter;
	q: string;
	sortBy: CampaignListSort;
};

type ParseOk = { ok: true; value: CampaignListParams };
type ParseErr = { ok: false; error: string };

function parsePositiveInt(raw: string | null, fallback: number): number | null {
	if (!raw) {
		return fallback;
	}
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) {
		return null;
	}
	return n;
}

function parseStatusFilter(raw: string): CampaignListStatusFilter | null {
	switch (raw) {
		case 'all':
		case 'draft':
		case 'active':
		case 'completed':
		case 'archived':
			return raw;
		default:
			return null;
	}
}

function parseSortBy(raw: string): CampaignListSort | null {
	switch (raw) {
		case 'newest':
		case 'updated':
		case 'alpha':
			return raw;
		default:
			return null;
	}
}

export function parseCampaignListParams(url: URL): ParseOk | ParseErr {
	const page = parsePositiveInt(url.searchParams.get('page'), 1);
	if (!page) {
		return { ok: false, error: 'Invalid page (must be a positive integer)' };
	}

	const limit = parsePositiveInt(url.searchParams.get('limit'), 10);
	if (!limit) {
		return { ok: false, error: 'Invalid limit (must be a positive integer)' };
	}
	// Avoid accidental unbounded queries.
	if (limit > 50) {
		return { ok: false, error: 'Invalid limit (max 50)' };
	}

	const statusRaw = (url.searchParams.get('status') || 'all').trim().toLowerCase();
	const status = parseStatusFilter(statusRaw);
	if (!status) {
		return {
			ok: false,
			error: 'Invalid status (expected one of: all, draft, active, completed, archived)',
		};
	}

	const sortByRaw = (url.searchParams.get('sortBy') || 'newest').trim().toLowerCase();
	const sortBy = parseSortBy(sortByRaw);
	if (!sortBy) {
		return {
			ok: false,
			error: 'Invalid sortBy (expected one of: newest, updated, alpha)',
		};
	}

	const q = (url.searchParams.get('q') || '').trim();

	return {
		ok: true,
		value: {
			page,
			limit,
			status,
			q,
			sortBy,
		},
	};
}
