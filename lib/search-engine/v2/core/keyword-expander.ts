/**
 * V2 Keyword Expander
 *
 * Uses AI (DeepSeek via OpenRouter) to expand keywords dynamically.
 * Key features:
 * - Calculate initial keyword count based on target
 * - Generate fresh variations when keywords exhaust
 * - Track processed keywords to avoid duplicates
 *
 * Design:
 * - For target 100 → ~3-4 keywords (each yields ~25-30 unique creators)
 * - For target 500 → ~15-20 keywords
 * - For target 1000 → ~30-40 keywords
 */

import { LOG_PREFIX } from './config';

// ============================================================================
// Constants
// ============================================================================

// Average unique creators per keyword (based on test data: ~40-50 per keyword)
const CREATORS_PER_KEYWORD = 45;

// AI expansion settings
const DEFAULT_EXPANSION_COUNT = 5;
const MAX_EXPANSION_RUNS = 10;
const MAX_KEYWORDS_TOTAL = 50;

// ============================================================================
// Types
// ============================================================================

export interface KeywordExpansionConfig {
	/** Enable AI keyword expansion (default: true) */
	enableExpansion: boolean;

	/** How many keywords to generate per expansion (default: 5) */
	keywordsPerExpansion: number;

	/** Maximum expansion rounds (default: 10) */
	maxExpansionRuns: number;

	/** Maximum total keywords to try (default: 50) */
	maxKeywordsTotal: number;
}

export interface KeywordExpansionState {
	/** All keywords that have been tried */
	processedKeywords: Set<string>;

	/** Original seed keywords from user */
	originalKeywords: string[];

	/** Current expansion round */
	expansionRun: number;

	/** Keywords waiting to be processed */
	pendingKeywords: string[];
}

export const DEFAULT_EXPANSION_CONFIG: KeywordExpansionConfig = {
	enableExpansion: true,
	keywordsPerExpansion: DEFAULT_EXPANSION_COUNT,
	maxExpansionRuns: MAX_EXPANSION_RUNS,
	maxKeywordsTotal: MAX_KEYWORDS_TOTAL,
};

// ============================================================================
// AI Keyword Expansion
// ============================================================================

/**
 * Expand a single keyword into related variations using AI
 */
export async function expandKeywordWithAI(
	keyword: string,
	count: number = DEFAULT_EXPANSION_COUNT,
	excludeKeywords: string[] = []
): Promise<string[]> {
	try {
		const apiKey = process.env.OPEN_ROUTER || process.env.OPENROUTER_API_KEY;
		if (!apiKey) {
			console.warn(`${LOG_PREFIX} OpenRouter API key not configured, using original keyword`);
			return [keyword];
		}

		const excludeSet = new Set(excludeKeywords.map((k) => k.toLowerCase().trim()));

		// Request more than needed to have room after filtering exclusions
		const requestCount = count + excludeKeywords.length + 5;

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://usegems.io',
				'X-Title': 'TikTok Creator Search',
			},
			body: JSON.stringify({
				model: 'deepseek/deepseek-chat',
				temperature: 0.8,
				max_tokens: 1000, // Increased for more keywords
				messages: [
					{
						role: 'system',
						content: `You are a TikTok marketing expert. Generate MANY strategic TikTok search keywords to find creators. Return ONLY a JSON array of strings with exactly the number requested.`,
					},
					{
						role: 'user',
						content: `Generate EXACTLY ${requestCount} unique TikTok search keywords for finding creators related to "${keyword}".

IMPORTANT: You MUST generate ${requestCount} different keywords. Include:
- The original keyword "${keyword}"
- Related niche terms (fitness -> gym, workout, exercise)
- Sub-niches (fitness -> yoga, crossfit, weightlifting, pilates)
- Trending hashtag variations (#fitnesstips, #gymlife)
- Action phrases ("how to workout", "best fitness tips")
- Audience-specific ("fitness for beginners", "home workout")
- Platform-specific ("tiktok fitness", "viral workout")

Return as JSON array with ${requestCount} items: ["keyword1", "keyword2", ...]`,
					},
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content || '[]';

		// Parse JSON response
		let keywords: string[] = [];
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				keywords = parsed;
			}
		} catch {
			// Fallback: extract quoted strings
			const matches = content.match(/"([^"]+)"/g);
			if (matches) {
				keywords = matches.map((m: string) => m.replace(/"/g, ''));
			}
		}

		// Filter out excluded keywords and empty strings
		const filtered = keywords
			.map((k) => k.trim())
			.filter((k) => k.length > 2 && k.length < 100)
			.filter((k) => !excludeSet.has(k.toLowerCase().trim()));

		console.log(`${LOG_PREFIX} AI expanded "${keyword}" → ${filtered.length} keywords`);

		return filtered.length > 0 ? filtered.slice(0, count) : [keyword];
	} catch (error) {
		console.warn(`${LOG_PREFIX} AI keyword expansion failed:`, error);
		return [keyword];
	}
}

/**
 * Generate continuation keywords - fresh variations excluding already-tried ones
 */
export async function generateContinuationKeywords(
	originalKeywords: string[],
	processedKeywords: string[],
	runNumber: number,
	count: number = DEFAULT_EXPANSION_COUNT
): Promise<string[]> {
	try {
		const apiKey = process.env.OPEN_ROUTER || process.env.OPENROUTER_API_KEY;
		if (!apiKey) {
			console.warn(`${LOG_PREFIX} OpenRouter API key not configured`);
			return generateFallbackKeywords(originalKeywords, processedKeywords, count);
		}

		const excludeSet = new Set(processedKeywords.map((k) => k.toLowerCase().trim()));

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://usegems.io',
				'X-Title': 'TikTok Creator Search',
			},
			body: JSON.stringify({
				model: 'deepseek/deepseek-chat',
				temperature: 0.8 + runNumber * 0.05, // Increase randomness each run
				max_tokens: 800, // Increased for more keywords
				messages: [
					{
						role: 'user',
						content: `Generate EXACTLY ${count} NEW TikTok search keywords related to: "${originalKeywords.join(', ')}"

IMPORTANT:
1. Generate exactly ${count} keywords
2. Do NOT include these already-tried keywords: ${processedKeywords.slice(0, 20).join(', ')}

Generate DIFFERENT variations like:
- Synonyms and related terms
- More specific niches within the topic
- Popular hashtag variations
- Trending phrases in this space
- Action-oriented phrases ("how to...", "best...", "tips")
- Audience segments ("for beginners", "advanced")
- Time-based ("2024", "2025", "new")

Return ONLY ${count} keywords, one per line, no numbering or explanation.`,
					},
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content || '';

		// Parse line-by-line response
		const keywords = content
			.split('\n')
			.map((line: string) => line.trim())
			.filter((line: string) => line.length > 2 && line.length < 100)
			.filter((line: string) => !line.match(/^\d+[.)]/)) // Remove numbering
			.filter((line: string) => !excludeSet.has(line.toLowerCase().trim()));

		console.log(
			`${LOG_PREFIX} Generated ${keywords.length} continuation keywords (run ${runNumber})`
		);

		return keywords.slice(0, count);
	} catch (error) {
		console.warn(`${LOG_PREFIX} Continuation keyword generation failed:`, error);
		return generateFallbackKeywords(originalKeywords, processedKeywords, count);
	}
}

/**
 * Fallback keyword generation when AI fails
 */
function generateFallbackKeywords(
	originalKeywords: string[],
	processedKeywords: string[],
	count: number
): string[] {
	const modifiers = [
		'tips',
		'tutorial',
		'ideas',
		'trends',
		'viral',
		'best',
		'top',
		'how to',
		'2024',
		'2025',
		'challenge',
		'hack',
		'review',
		'guide',
	];

	const excludeSet = new Set(processedKeywords.map((k) => k.toLowerCase().trim()));
	const fallbackKeywords: string[] = [];

	for (const kw of originalKeywords) {
		for (const mod of modifiers) {
			const combo = `${kw} ${mod}`;
			if (!excludeSet.has(combo.toLowerCase())) {
				fallbackKeywords.push(combo);
				if (fallbackKeywords.length >= count) break;
			}
		}
		if (fallbackKeywords.length >= count) break;
	}

	return fallbackKeywords.slice(0, count);
}

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
	// Add 20% buffer for duplicates and failed expansions
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

	console.log(
		`${LOG_PREFIX} Expanding keywords for target ${targetCreators} (need ~${keywordsNeeded} keywords)`
	);

	// Start with original keywords
	for (const kw of originalKeywords) {
		if (!processedSet.has(kw.toLowerCase().trim())) {
			expandedKeywords.push(kw);
			processedSet.add(kw.toLowerCase().trim());
		}
	}

	// Expand each original keyword - request enough to meet target
	for (const kw of originalKeywords) {
		if (expandedKeywords.length >= keywordsNeeded) break;

		// Calculate how many more keywords we need
		const remainingNeeded = keywordsNeeded - expandedKeywords.length;
		// Request more than needed to account for duplicates/filtering
		const requestCount = Math.min(Math.ceil(remainingNeeded * 1.5), 30);

		const expanded = await expandKeywordWithAI(kw, requestCount, Array.from(processedSet));

		for (const expKw of expanded) {
			const normalized = expKw.toLowerCase().trim();
			if (!processedSet.has(normalized)) {
				expandedKeywords.push(expKw);
				processedSet.add(normalized);
			}
			if (expandedKeywords.length >= keywordsNeeded) break;
		}
	}

	// If still not enough, do additional expansion rounds
	let expansionRun = 0;
	while (expandedKeywords.length < keywordsNeeded && expansionRun < config.maxExpansionRuns) {
		expansionRun++;
		const remainingNeeded = keywordsNeeded - expandedKeywords.length;
		const requestCount = Math.min(Math.ceil(remainingNeeded * 1.5), 20);

		console.log(
			`${LOG_PREFIX} Additional expansion run ${expansionRun}, need ${remainingNeeded} more keywords`
		);

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
			if (expandedKeywords.length >= keywordsNeeded) break;
		}

		// Break if no new keywords generated
		if (moreKeywords.length === 0) break;
	}

	console.log(
		`${LOG_PREFIX} Expanded ${originalKeywords.length} → ${expandedKeywords.length} keywords`
	);

	return {
		keywords: expandedKeywords,
		processedKeywords: Array.from(processedSet),
	};
}

// ============================================================================
// Dynamic Keyword Generator
// ============================================================================

/**
 * Create a keyword generator that can dynamically add more keywords
 * as existing ones get exhausted
 */
export function createKeywordGenerator(
	originalKeywords: string[],
	targetCreators: number,
	config: KeywordExpansionConfig = DEFAULT_EXPANSION_CONFIG
): KeywordGenerator {
	return new KeywordGenerator(originalKeywords, targetCreators, config);
}

export class KeywordGenerator {
	private originalKeywords: string[];
	private targetCreators: number;
	private config: KeywordExpansionConfig;
	private state: KeywordExpansionState;
	private isExpanding = false;

	constructor(
		originalKeywords: string[],
		targetCreators: number,
		config: KeywordExpansionConfig = DEFAULT_EXPANSION_CONFIG
	) {
		this.originalKeywords = originalKeywords;
		this.targetCreators = targetCreators;
		this.config = config;
		this.state = {
			processedKeywords: new Set(),
			originalKeywords: [...originalKeywords],
			expansionRun: 0,
			pendingKeywords: [],
		};
	}

	/**
	 * Initialize with expanded keywords
	 */
	async initialize(): Promise<string[]> {
		if (!this.config.enableExpansion) {
			this.state.pendingKeywords = [...this.originalKeywords];
			for (const kw of this.originalKeywords) {
				this.state.processedKeywords.add(kw.toLowerCase().trim());
			}
			return this.state.pendingKeywords;
		}

		const { keywords, processedKeywords } = await expandKeywordsForTarget(
			this.originalKeywords,
			this.targetCreators,
			this.config
		);

		this.state.pendingKeywords = keywords;
		for (const kw of processedKeywords) {
			this.state.processedKeywords.add(kw.toLowerCase().trim());
		}

		return keywords;
	}

	/**
	 * Mark a keyword as used (remove from pending)
	 */
	markUsed(keyword: string): void {
		const idx = this.state.pendingKeywords.indexOf(keyword);
		if (idx !== -1) {
			this.state.pendingKeywords.splice(idx, 1);
		}
	}

	/**
	 * Get remaining pending keywords
	 */
	getPendingKeywords(): string[] {
		return [...this.state.pendingKeywords];
	}

	/**
	 * Check if more keywords are available
	 */
	hasMoreKeywords(): boolean {
		return this.state.pendingKeywords.length > 0;
	}

	/**
	 * Check if we can expand more keywords
	 */
	canExpand(): boolean {
		return (
			this.config.enableExpansion &&
			this.state.expansionRun < this.config.maxExpansionRuns &&
			this.state.processedKeywords.size < this.config.maxKeywordsTotal
		);
	}

	/**
	 * Expand more keywords (if allowed)
	 * Returns new keywords added
	 */
	async expandMore(): Promise<string[]> {
		if (!this.canExpand() || this.isExpanding) {
			return [];
		}

		this.isExpanding = true;
		this.state.expansionRun++;

		try {
			const newKeywords = await generateContinuationKeywords(
				this.originalKeywords,
				Array.from(this.state.processedKeywords),
				this.state.expansionRun,
				this.config.keywordsPerExpansion
			);

			const added: string[] = [];
			for (const kw of newKeywords) {
				const normalized = kw.toLowerCase().trim();
				if (!this.state.processedKeywords.has(normalized)) {
					this.state.processedKeywords.add(normalized);
					this.state.pendingKeywords.push(kw);
					added.push(kw);
				}
			}

			console.log(
				`${LOG_PREFIX} Expansion run ${this.state.expansionRun}: +${added.length} keywords`
			);

			return added;
		} finally {
			this.isExpanding = false;
		}
	}

	/**
	 * Get total processed keywords count
	 */
	getProcessedCount(): number {
		return this.state.processedKeywords.size;
	}

	/**
	 * Get expansion run count
	 */
	getExpansionRun(): number {
		return this.state.expansionRun;
	}
}
