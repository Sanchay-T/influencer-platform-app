export type CreatorEnrichmentPlatform = 'tiktok' | 'instagram' | 'youtube';

export interface CreatorEnrichmentSummary {
	primaryEmail?: string;
	allEmails: string[];
	followerCounts: Record<string, number>;
	engagementRates: Record<string, number>;
	brands: string[];
	crossPlatformHandles: Record<string, string>;
	location?: string;
	lastContentTimestamp?: string;
}

export interface CreatorEnrichmentRecord {
	creatorId: string;
	handle: string;
	platform: string;
	enrichedAt: string;
	source: 'influencers_club';
	payload: unknown;
	summary: CreatorEnrichmentSummary;
	request: {
		handle: string;
		platform: string;
		includeLookalikes: boolean;
		emailRequired: 'preferred' | 'must_have';
	};
}

export interface CreatorEnrichmentUsage {
	count: number;
	limit: number;
}

export interface CreatorEnrichmentResult {
	record: CreatorEnrichmentRecord;
	usage: CreatorEnrichmentUsage;
}
