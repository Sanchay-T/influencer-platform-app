/**
 * V2 Keyword Expander
 *
 * Planning and expansion logic for keywords.
 * Uses AI (DeepSeek via OpenRouter) to expand keywords dynamically.
 */

import { expandKeywordWithAI, generateContinuationKeywords } from './ai-expansion';

// Re-export for external use
export {
	expandKeywordWithAI,
	generateContinuationKeywords,
	generateFallbackKeywords,
} from './ai-expansion';
export { type KeywordExpansionState, KeywordGenerator } from './keyword-generator';

// ============================================================================
// Constants
// ============================================================================

const CREATORS_PER_KEYWORD = 45;
const DEFAULT_EXPANSION_COUNT = 5;
const MAX_EXPANSION_RUNS = 10;
const MAX_KEYWORDS_TOTAL = 50;

// ============================================================================
// Types
// ============================================================================

export interface KeywordExpansionConfig {
	enableExpansion: boolean;
	keywordsPerExpansion: number;
	maxExpansionRuns: number;
	maxKeywordsTotal: number;
}

export const DEFAULT_EXPANSION_CONFIG: KeywordExpansionConfig = {
	enableExpansion: true,
	keywordsPerExpansion: DEFAULT_EXPANSION_COUNT,
	maxExpansionRuns: MAX_EXPANSION_RUNS,
	maxKeywordsTotal: MAX_KEYWORDS_TOTAL,
};

// ============================================================================
// Keyword Planning
// ============================================================================

/**
 * Calculate how many keywords we need for a target creator count
 */
export function calculateKeywordsNeeded(
	targetCreators: number,
	creatorsPerKeyword: number = CREATORS_PER_KEYWORD
): number {
	const needed = Math.ceil((targetCreators / creatorsPerKeyword) * 1.2);
	return Math.min(needed, MAX_KEYWORDS_TOTAL);
}

/**
 * Expand initial keywords to match target
 */
export async function expandKeywordsForTarget(
	originalKeywords: string[],
	targetCreators: number,
	config: KeywordExpansionConfig = DEFAULT_EXPANSION_CONFIG
): Promise<{ keywords: string[]; processedKeywords: string[] }> {
	if (!config.enableExpansion) {
		return {
			keywords: originalKeywords,
			processedKeywords: [...originalKeywords],
		};
	}

	const keywordsNeeded = calculateKeywordsNeeded(targetCreators);
	const processedSet = new Set<string>();
	const expandedKeywords: string[] = [];

	// Start with original keywords
	for (const kw of originalKeywords) {
		if (!processedSet.has(kw.toLowerCase().trim())) {
			expandedKeywords.push(kw);
			processedSet.add(kw.toLowerCase().trim());
		}
	}

	// Expand each original keyword
	for (const kw of originalKeywords) {
		if (expandedKeywords.length >= keywordsNeeded) {
			break;
		}

		const remainingNeeded = keywordsNeeded - expandedKeywords.length;
		const requestCount = Math.min(Math.ceil(remainingNeeded * 1.5), 30);

		const expanded = await expandKeywordWithAI(kw, requestCount, Array.from(processedSet));

		for (const expKw of expanded) {
			const normalized = expKw.toLowerCase().trim();
			if (!processedSet.has(normalized)) {
				expandedKeywords.push(expKw);
				processedSet.add(normalized);
			}
			if (expandedKeywords.length >= keywordsNeeded) {
				break;
			}
		}
	}

	// Additional expansion rounds if needed
	let expansionRun = 0;
	while (expandedKeywords.length < keywordsNeeded && expansionRun < config.maxExpansionRuns) {
		expansionRun++;
		const remainingNeeded = keywordsNeeded - expandedKeywords.length;
		const requestCount = Math.min(Math.ceil(remainingNeeded * 1.5), 20);

		const moreKeywords = await generateContinuationKeywords(
			originalKeywords,
			Array.from(processedSet),
			expansionRun,
			requestCount
		);

		for (const kw of moreKeywords) {
			const normalized = kw.toLowerCase().trim();
			if (!processedSet.has(normalized)) {
				expandedKeywords.push(kw);
				processedSet.add(normalized);
			}
			if (expandedKeywords.length >= keywordsNeeded) {
				break;
			}
		}

		if (moreKeywords.length === 0) {
			break;
		}
	}

	return {
		keywords: expandedKeywords,
		processedKeywords: Array.from(processedSet),
	};
}

// ============================================================================
// Factory Function
// ============================================================================

import { KeywordGenerator } from './keyword-generator';

/**
 * Create a keyword generator for dynamic expansion
 */
export function createKeywordGenerator(
	originalKeywords: string[],
	targetCreators: number,
	config: KeywordExpansionConfig = DEFAULT_EXPANSION_CONFIG
): KeywordGenerator {
	return new KeywordGenerator(originalKeywords, targetCreators, config);
}
