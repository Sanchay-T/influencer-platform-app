export type UsDecision = 'US' | 'NotUS' | 'Unknown';
export type RelevanceDecision = 'match' | 'partial' | 'no';

export interface ReelRow {
    url: string;
    keyword: string;
    owner_handle?: string;
    owner_name?: string;
    caption?: string;
    transcript?: string;
    views?: number;
    thumbnail?: string;
    location_name?: string;
    us_decision?: UsDecision;
    relevance_decision?: RelevanceDecision;
    discovered_at?: string;
    updated_at?: string;
    status?: string;
}

export interface SessionMetadata {
    sessionId: string;
    keyword: string;
    startTime: string;
    endTime?: string;
    totalUrls: number;
    totalProcessed: number;
    totalRelevant: number;
    totalUS: number;
    status: 'running' | 'completed' | 'failed';
}

export interface SessionState {
    rows: ReelRow[];
    metadata: SessionMetadata;
    costSummary?: unknown;
}
