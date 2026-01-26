import OpenAI from 'openai';
import { structuredConsole } from '@/lib/logging/console-proxy';

export class OpenRouterService {
	private openai: OpenAI;

	constructor() {
		this.openai = new OpenAI({
			baseURL: 'https://openrouter.ai/api/v1',
			apiKey: process.env.OPEN_ROUTER || process.env.OPENROUTER_API_KEY,
			defaultHeaders: {
				'HTTP-Referer': 'https://influencer-platform.vercel.app',
				'X-Title': 'Instagram AI Analyzer',
			},
		});
	}

	async chat(
		messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
		options?: {
			model?: string;
			temperature?: number;
			maxTokens?: number;
		}
	): Promise<string> {
		const completion = await this.openai.chat.completions.create({
			model: options?.model ?? 'deepseek/deepseek-chat',
			messages,
			temperature: options?.temperature,
			max_tokens: options?.maxTokens,
		});

		return completion.choices[0]?.message?.content ?? '';
	}

	async generateKeywordExpansions(originalQuery: string, count: number = 5): Promise<string[]> {
		try {
			const completion = await this.openai.chat.completions.create({
				model: 'deepseek/deepseek-chat',
				messages: [
					{
						role: 'system',
						content: `You are an Instagram marketing expert. Generate ${count} strategic search keywords based on the original query. Return only a JSON array of strings.`,
					},
					{
						role: 'user',
						content: `Generate ${count} Instagram search keywords for "${originalQuery}". Include the original plus ${count - 1} variations. Return as JSON array: ["${originalQuery}", "variation1", "variation2", ...]`,
					},
				],
				temperature: 0.7,
			});

			const responseText = completion.choices[0].message.content || '[]';

			try {
				const keywords = JSON.parse(responseText);
				if (Array.isArray(keywords)) {
					return keywords.slice(0, count);
				}
			} catch {
				// Fallback: extract keywords from text
				const matches = responseText.match(/"([^"]+)"/g);
				if (matches) {
					return matches.map((m) => m.replace(/"/g, '')).slice(0, count);
				}
			}

			// Final fallback
			return [originalQuery];
		} catch (error) {
			structuredConsole.error('AI keyword generation failed:', error);
			return [originalQuery];
		}
	}
}
