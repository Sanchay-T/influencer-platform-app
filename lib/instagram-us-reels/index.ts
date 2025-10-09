import type { PipelineContext, ScoredReel } from './types';
import { expandKeyword as expandKeywordStep } from './steps/keyword-expansion';
import { harvestHandles as harvestHandlesStep } from './steps/handle-harvest';
import { screenProfiles as screenProfilesStep } from './steps/profile-screen';
import { fetchReelsForProfiles as fetchReelsStep } from './steps/reel-fetch';
import { attachTranscripts as attachTranscriptsStep } from './steps/transcript-fetch';
import { scoreReels as scoreReelsStep } from './steps/scoring';
import type { KeywordExpansionResult } from './types';
import { writeSnapshot } from './utils/logging';

export interface InstagramUsReelsPipelineOptions {
  serpEnabled?: boolean;
  maxProfiles?: number;
  reelsPerProfile?: number;
  transcripts?: boolean;
}

let expandKeyword = expandKeywordStep;
let harvestHandles = harvestHandlesStep;
let screenProfiles = screenProfilesStep;
let fetchReels = fetchReelsStep;
let attachTranscripts = attachTranscriptsStep;
let scoreReels = scoreReelsStep;

export interface PipelineOverrides {
  expandKeyword?: typeof expandKeywordStep;
  harvestHandles?: typeof harvestHandlesStep;
  screenProfiles?: typeof screenProfilesStep;
  fetchReels?: typeof fetchReelsStep;
  attachTranscripts?: typeof attachTranscriptsStep;
  scoreReels?: typeof scoreReelsStep;
}

export function setPipelineOverrides(overrides: PipelineOverrides): void {
  if (overrides.expandKeyword) expandKeyword = overrides.expandKeyword;
  if (overrides.harvestHandles) harvestHandles = overrides.harvestHandles;
  if (overrides.screenProfiles) screenProfiles = overrides.screenProfiles;
  if (overrides.fetchReels) fetchReels = overrides.fetchReels;
  if (overrides.attachTranscripts) attachTranscripts = overrides.attachTranscripts;
  if (overrides.scoreReels) scoreReels = overrides.scoreReels;
}

export async function runInstagramUsReelsPipeline(
  context: PipelineContext,
  options: InstagramUsReelsPipelineOptions = {},
): Promise<ScoredReel[]> {
  const keyword = context.keyword.trim();
  if (!keyword) {
    throw new Error('Keyword must not be empty.');
  }

  const expansion = (await expandKeyword({ keyword })) as KeywordExpansionResult;
  writeSnapshot('step-1-expansion', expansion);

  const handles = await harvestHandles(expansion, {
    serpEnabled: options.serpEnabled ?? true,
  });
  writeSnapshot('step-2-handles', handles);

  if (handles.handles.length === 0) {
    return [];
  }

  const profiles = await screenProfiles(handles.handles, {
    limit: options.maxProfiles ?? Number(process.env.US_REELS_MAX_PROFILES ?? 8),
  });
  writeSnapshot('step-3-profiles', profiles);

  if (profiles.accepted.length === 0) {
    return [];
  }

  const reels = await fetchReels(profiles.accepted, {
    amountPerProfile: options.reelsPerProfile ?? Number(process.env.US_REELS_PER_PROFILE ?? 12),
    fetchDetails: true,
  });
  writeSnapshot('step-4-reels', reels);

  if (options.transcripts ?? true) {
    await attachTranscripts(reels, {
      concurrency: Number(process.env.US_REELS_TRANSCRIPT_CONCURRENCY ?? 2),
    });
    writeSnapshot('step-5-transcripts', reels.map((reel) => ({
      id: reel.id,
      shortcode: reel.shortcode,
      hasTranscript: Boolean(reel.transcript),
    })));
  }

  const scored = scoreReels(reels, expansion);
  writeSnapshot('step-6-scored', scored);
  return scored;
}
