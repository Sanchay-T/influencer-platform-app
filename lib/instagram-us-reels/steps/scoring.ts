import type { KeywordExpansionResult, ReelMedia, ScoredReel } from '../types';

export interface ScoringOptions {
  now?: number;
}

export function scoreReels(
  reels: ReelMedia[],
  expansion: KeywordExpansionResult,
  options: ScoringOptions = {},
): ScoredReel[] {
  const now = options.now ?? Date.now();
  const keyword = expansion.seedKeyword.toLowerCase();
  const secondaryTerms = new Set(
    [...expansion.enrichedQueries, ...expansion.hashtags]
      .map((term) => term.toLowerCase())
      .filter(Boolean),
  );

  return reels
    .map((reel) => {
      const caption = (reel.caption ?? '').toLowerCase();
      const transcript = (reel.transcript ?? '').toLowerCase();

      let score = 0.3; // base relevance
      const matches: string[] = [];

      if (caption.includes(keyword) || transcript.includes(keyword)) {
        score += 0.35;
        matches.push(keyword);
      }

      for (const term of secondaryTerms) {
        if (term && (caption.includes(term) || transcript.includes(term))) {
          score += 0.15;
          matches.push(term);
        }
      }

      const recencyBoost = computeRecencyBoost(reel.takenAt, now);
      score += recencyBoost;

      if (typeof reel.viewCount === 'number') {
        score += Math.min(Math.log10(reel.viewCount + 1) / 10, 0.2);
      }

      const usConfidence = reel.owner.countryConfidence ?? 0;
      score += Math.min(usConfidence, 0.3);

      score = Math.min(score, 1);

      const scored: ScoredReel = {
        ...reel,
        relevanceScore: score,
        usConfidence,
      };

      (scored as any).matchedTerms = matches;
      return scored;
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function computeRecencyBoost(takenAt: number, now: number): number {
  const ageDays = Math.max(0, (now - takenAt * 1000) / (1000 * 60 * 60 * 24));
  if (ageDays <= 3) return 0.2;
  if (ageDays <= 7) return 0.15;
  if (ageDays <= 30) return 0.1;
  if (ageDays <= 90) return 0.05;
  return 0;
}
