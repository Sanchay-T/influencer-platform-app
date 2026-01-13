export type PlatformResult = unknown[];

export interface ScrapingResult {
	id: string;
	createdAt: Date;
	jobId: string | null;
	creators: PlatformResult;
}

export interface ScrapingJob {
	id: string;
	userId: string;
	runId: string | null;
	status: string;
	keywords: string[] | null;
	targetUsername: string | null;
	searchParams: unknown;
	platform: string;
	region: string;
	startedAt: Date | null;
	completedAt: Date | null;
	error: string | null;
	timeoutAt: Date | null;
	campaignId: string | null;
	createdAt: Date;
	results: ScrapingResult[];
	scraperLimit: number | null;
	progress?: number;
	// Added for sidebar creator counts
	processedResults?: number | null;
	targetResults?: number | null;
	// Server pre-loaded total count (from job_creators table)
	totalCreators?: number;
}

export interface Campaign {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	searchType: string;
	status: string;
	createdAt: Date;
	updatedAt: Date;
	scrapingJobs: ScrapingJob[];
}
