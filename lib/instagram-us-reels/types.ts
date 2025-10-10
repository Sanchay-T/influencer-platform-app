export interface PipelineContext {
  keyword: string;
}

export interface KeywordExpansionInput {
  keyword: string;
}

export interface CandidateHandle {
  handle: string;
  confidence?: number;
  reason?: string;
  source?: string;
}

export interface KeywordExpansionResult {
  seedKeyword: string;
  enrichedQueries: string[];
  hashtags: string[];
  candidateHandles: CandidateHandle[];
}

export interface HandleHarvestResult {
  handles: CandidateHandle[];
}

export interface ProfileSummary {
  handle: string;
  userId: string;
  fullName: string;
  isPrivate: boolean;
  followerCount?: number;
  locationHints: string[];
  countryConfidence: number;
  isLikelyUS: boolean;
  raw: any;
}

export interface ProfileScreenResult {
  accepted: ProfileSummary[];
  rejected: ProfileSummary[];
}

export interface ReelMedia {
  id: string;
  shortcode: string;
  url: string;
  caption?: string;
  takenAt: number;
  viewCount?: number;
  likeCount?: number;
  transcript?: string | null;
  thumbnail?: string | null;
  owner: ProfileSummary;
}

export interface ScoredReel extends ReelMedia {
  relevanceScore: number;
  usConfidence: number;
}
