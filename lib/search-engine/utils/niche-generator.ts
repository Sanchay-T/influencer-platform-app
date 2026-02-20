/**
 * Niche Description Generator
 *
 * Uses DeepSeek via OpenRouter to generate niche search queries
 * for finding similar creators on Instagram/TikTok.
 */

import { structuredConsole } from '@/lib/logging/console-proxy';
import type { EnrichCreator } from '@/lib/services/influencers-club';

/**
 * Generate a niche description from an enriched creator profile.
 * Used to replace the broken `similar_to` filter with `ai_search`.
 */
export async function generateNicheDescription(
	username: string,
	profile: EnrichCreator | null
): Promise<string> {
	const fallback = `creators similar to @${username}`;

	const apiKey = process.env.OPEN_ROUTER || process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return fallback;
	}

	// Extract themes from post captions
	const themes = extractThemesFromProfile(username, profile);

	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://usegems.io',
				'X-Title': 'Similar Creator Search',
			},
			body: JSON.stringify({
				model: 'deepseek/deepseek-chat',
				temperature: 0.7,
				max_tokens: 200,
				messages: [
					{
						role: 'user',
						content: `Given the creator @${username} who posts about: ${themes}

Generate a 10-15 word search query to find similar Instagram/TikTok creators in this exact niche. Focus on their specific content style and audience, not generic category terms.

Return ONLY the search query, nothing else.`,
					},
				],
			}),
		});

		if (!response.ok) {
			structuredConsole.warn('[niche-generator] OpenRouter API error:', response.status);
			return fallback;
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content?.trim();

		if (content && content.length > 5 && content.length < 200) {
			return content.replace(/^["']|["']$/g, '');
		}

		return fallback;
	} catch (error) {
		structuredConsole.warn('[niche-generator] Failed to generate niche description', error);
		return fallback;
	}
}

function extractThemesFromProfile(username: string, profile: EnrichCreator | null): string {
	if (!profile) {
		return username;
	}

	const parts: string[] = [];

	if (profile.full_name) {
		parts.push(profile.full_name);
	}

	// Extract themes from post captions
	if (profile.post_data) {
		const captions = Object.values(profile.post_data)
			.map((post) => post.caption)
			.filter((c): c is string => !!c)
			.slice(0, 5);

		if (captions.length > 0) {
			// Take first 300 chars of combined captions to avoid token bloat
			parts.push(captions.join('. ').slice(0, 300));
		}

		// Extract common hashtags
		const allHashtags = Object.values(profile.post_data)
			.flatMap((post) => post.hashtags ?? [])
			.slice(0, 10);
		if (allHashtags.length > 0) {
			parts.push(`hashtags: ${allHashtags.join(', ')}`);
		}
	}

	if (profile.follower_count) {
		parts.push(`${profile.follower_count.toLocaleString()} followers`);
	}

	return parts.length > 0 ? parts.join('. ') : username;
}
