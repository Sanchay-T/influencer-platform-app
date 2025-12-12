/**
 * Job Tracker Types
 *
 * Type definitions for V2 job coordination.
 */

// ============================================================================
// Status Types
// ============================================================================

export type V2JobStatus =
	| 'pending'
	| 'dispatching'
	| 'searching'
	| 'enriching'
	| 'completed'
	| 'error'
	| 'partial';

export type EnrichmentStatus = 'pending' | 'in_progress' | 'completed';

// ============================================================================
// Progress Types
// ============================================================================

export interface JobProgress {
	keywordsDispatched: number;
	keywordsCompleted: number;
	creatorsFound: number;
	creatorsEnriched: number;
	enrichmentStatus: EnrichmentStatus;
	status: V2JobStatus;
}

export interface JobSnapshot {
	id: string;
	userId: string;
	campaignId: string | null;
	platform: string;
	keywords: string[];
	targetResults: number;
	status: V2JobStatus;
	progress: JobProgress;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================================================
// Constants
// ============================================================================

// Timeout for stale job detection (2 minutes)
export const STALE_JOB_TIMEOUT_MS = 2 * 60 * 1000;

// Minimum enrichment percentage to consider job "good enough" for completion
export const MIN_ENRICHMENT_PERCENTAGE = 80;
