/**
 * AI Keyword Expansion
 *
 * Uses DeepSeek via OpenRouter to expand keywords dynamically.
 */

import { proxyFetch } from '@/lib/utils/proxy-fetch';
import { LOG_PREFIX } from './config';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_EXPANSION_COUNT = 5;

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
		const requestCount = count + excludeKeywords.length + 5;

		const response = await proxyFetch('https://openrouter.ai/api/v1/chat/completions', {
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
				max_tokens: 1000,
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

		let keywords: string[] = [];
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				keywords = parsed;
			}
		} catch {
			const matches = content.match(/"([^"]+)"/g);
			if (matches) {
				keywords = matches.map((m: string) => m.replace(/"/g, ''));
			}
		}

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

		const response = await proxyFetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://usegems.io',
				'X-Title': 'TikTok Creator Search',
			},
			body: JSON.stringify({
				model: 'deepseek/deepseek-chat',
				temperature: 0.8 + runNumber * 0.05,
				max_tokens: 800,
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

		const keywords = content
			.split('\n')
			.map((line: string) => line.trim())
			.filter((line: string) => line.length > 2 && line.length < 100)
			.filter((line: string) => !line.match(/^\d+[.)]/))
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
export function generateFallbackKeywords(
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
