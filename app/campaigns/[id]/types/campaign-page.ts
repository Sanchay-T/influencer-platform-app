/**
 * Types for the campaign detail page
 * Extracted from client-page.tsx for modularity
 */
import type { Campaign, ScrapingJob } from '@/app/types/campaign';

// Creators array type - flexible to handle various platform response shapes
export type PlatformResult = unknown[];

export type HandleQueueMetric = {
	handle: string;
	keyword?: string | null;
	totalCreators: number;
	newCreators: number;
	duplicateCreators: number;
	batches?: number;
	lastUpdatedAt?: string | null;
};

export type HandleQueueState = {
	totalHandles: number;
	completedHandles: string[];
	remainingHandles: string[];
	activeHandle: string | null;
	metrics: Record<string, HandleQueueMetric>;
	lastUpdatedAt?: string | null;
};

export type UiScrapingJob = ScrapingJob & {
	resultsLoaded?: boolean;
	totalCreators?: number;
	resultsError?: string | null;
	pagination?: {
		total?: number;
		limit?: number;
		nextOffset?: number | null;
	};
	creatorBuffer?: unknown[];
	pageLimit?: number;
	handleQueue?: HandleQueueState | null;
};

export type SearchDiagnostics = {
	engine: string;
	queueLatencyMs: number | null;
	processingMs: number | null;
	totalMs: number | null;
	apiCalls: number | null;
	processedCreators: number | null;
	batches: Array<{
		index?: number;
		size?: number;
		durationMs?: number;
		handle?: string | null;
		keyword?: string | null;
		newCreators?: number;
		totalCreators?: number;
		duplicates?: number;
		note?: string | null;
	}>;
	startedAt?: string | null;
	finishedAt?: string | null;
	lastUpdated: string;
	handles?: {
		totalHandles?: number;
		completedHandles?: string[];
		remainingHandles?: string[];
	} | null;
};

export interface ClientCampaignPageProps {
	campaign: Campaign | null;
}

export type CampaignStatus = 'no-results' | 'active' | 'completed' | 'error';

export type StatusVariant = {
	badge: string;
	dot: string;
	label: string;
};

// Re-export for convenience
export type { Campaign, ScrapingJob };
