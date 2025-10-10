import type { KeywordExpansionResult, ReelMedia, ScoredReel } from '../types';

export interface ScoringOptions {
  now?: number;
  originalKeyword?: string;
}

const STOP_WORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'this',
  'that',
  'your',
  'you',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'will',
  'can',
  'could',
  'should',
  'would',
  'their',
  'there',
  'here',
  'into',
  'over',
  'than',
  'when',
  'what',
  'where',
  'which',
  'about',
  'just',
  'like',
  'ever',
  'then',
  'also',
  'some',
  'more',
  'less',
]);

export function scoreReels(
  reels: ReelMedia[],
  expansion: KeywordExpansionResult,
  options: ScoringOptions = {},
): ScoredReel[] {
  const now = options.now ?? Date.now();
  const primaryTerms = new Set<string>();

  const registerPrimary = (value: string | undefined | null) => {
    if (!value) return;
    const normalized = value.toLowerCase().trim();
    if (!normalized) return;
    primaryTerms.add(normalized);
  };

  registerPrimary(expansion.seedKeyword);
  registerPrimary(options.originalKeyword);

  const keyword = expansion.seedKeyword.toLowerCase();
  const secondaryTerms = new Set<string>();

  const pushTerm = (term: string | undefined | null) => {
    if (!term) return;
    const normalized = term.toLowerCase().trim();
    if (!normalized) return;
    if (!STOP_WORDS.has(normalized)) {
      secondaryTerms.add(normalized);
    }
    normalized
      .split(/[^a-z0-9+#]+/i)
      .map((piece) => piece.trim())
      .filter((piece) => piece.length >= 3 && !STOP_WORDS.has(piece.toLowerCase()))
      .forEach((piece) => secondaryTerms.add(piece.toLowerCase()));
  };

  [...expansion.enrichedQueries, ...expansion.hashtags].forEach((term) => pushTerm(term));
  keyword
    .split(/[^a-z0-9+#]+/i)
    .filter((piece) => piece.length >= 3)
    .forEach((piece) => secondaryTerms.add(piece));

  return reels
    .map((reel) => {
      const caption = (reel.caption ?? '').toLowerCase();
      const transcript = (reel.transcript ?? '').toLowerCase();
      const corpus = `${caption}\n${transcript}`;

      let score = 0;
      const matches: string[] = [];
      let primaryMatched = false;

      const matchesTerm = (text: string, term: string): boolean => {
        if (!term) return false;
        if (text.includes(term)) return true;
        const tokens = term
          .split(/[^a-z0-9+#]+/i)
          .map((token) => token.trim())
          .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
        if (tokens.length === 0) return false;
        return tokens.every((token) => text.includes(token));
      };

      for (const term of primaryTerms) {
        if (matchesTerm(corpus, term)) {
          score += 0.55;
          if (!STOP_WORDS.has(term)) {
            matches.push(term);
          }
          primaryMatched = true;
          break;
        }
      }

      let secondaryBoost = 0;
      for (const term of secondaryTerms) {
        if (matchesTerm(corpus, term)) {
          secondaryBoost += 0.12;
          if (!STOP_WORDS.has(term)) {
            matches.push(term);
          }
        }
      }
      score += Math.min(secondaryBoost, 0.36);

      const recencyBoost = computeRecencyBoost(reel.takenAt, now);
      score += recencyBoost;

      if (typeof reel.viewCount === 'number') {
        score += Math.min(Math.log10(reel.viewCount + 1) / 12, 0.18);
      }

      const usConfidence = reel.owner.countryConfidence ?? 0;
      score += Math.min(usConfidence, 0.25);

      if (!primaryMatched && matches.length === 0) {
        score *= 0.25;
      }

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
