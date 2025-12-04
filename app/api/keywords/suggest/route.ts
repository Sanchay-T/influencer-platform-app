import { NextResponse } from 'next/server';

type SuggestionRequestBody = {
	seed?: string;
	existingKeywords?: string[];
	limit?: number;
	platform?: string;
};

type SuggestionItem = {
	keyword: string;
	confidence?: number;
	rationale?: string;
};

type CacheEntry = {
	expiresAt: number;
	suggestions: SuggestionItem[];
};

const CACHE_TTL_MS = Number(process.env.KEYWORD_SUGGESTION_CACHE_TTL_MS ?? 3 * 60 * 1000);
const MAX_SUGGESTIONS = Number(process.env.KEYWORD_SUGGESTION_MAX ?? 12);
const MIN_SEED_LENGTH = 3;
const suggestionCache = new Map<string, CacheEntry>();

const encoder = new TextEncoder();

const schema = {
	name: 'KeywordSuggestions',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['suggestions'],
		properties: {
			suggestions: {
				type: 'array',
				minItems: 3,
				maxItems: MAX_SUGGESTIONS,
				items: {
					type: 'object',
					required: ['keyword', 'confidence', 'rationale'],
					additionalProperties: false,
					properties: {
						keyword: { type: 'string', minLength: MIN_SEED_LENGTH, maxLength: 80 },
						confidence: { type: 'number', minimum: 0, maximum: 1 },
						rationale: { type: 'string', minLength: 0, maxLength: 120 },
					},
				},
			},
		},
	},
} as const;

const defaultModel = process.env.OPENAI_SUGGESTION_MODEL || 'gpt-4o-mini';

function sanitizeKeyword(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.replace(/\s+/g, ' ').trim();
	if (normalized.length < MIN_SEED_LENGTH || normalized.length > 80) return null;
	return normalized;
}

function extractAnchorTokens(seed: string): string[] {
	return seed
		.toLowerCase()
		.split(/\s+/)
		.map((token) => token.replace(/[^a-z0-9]+/g, '').trim())
		.filter((token) => token.length >= 3);
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: unknown) {
	controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function buildCacheKey(
	seed: string,
	platform: string | undefined,
	planHint: string | undefined
): string {
	return JSON.stringify({
		seed,
		platform: (platform || '').toLowerCase(),
		plan: (planHint || '').toLowerCase(),
	});
}

function readCache(key: string): SuggestionItem[] | null {
	const cached = suggestionCache.get(key);
	if (!cached) return null;
	if (Date.now() > cached.expiresAt) {
		suggestionCache.delete(key);
		return null;
	}
	return cached.suggestions;
}

function storeCache(key: string, suggestions: SuggestionItem[]) {
	suggestionCache.set(key, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		suggestions,
	});
}

async function streamOpenAICompletion({
	seed,
	existingKeywords,
	limit,
	platform,
	planHint,
	emitToken,
}: {
	seed: string;
	existingKeywords: string[];
	limit: number;
	platform?: string;
	planHint?: string;
	emitToken?: (token: string) => void;
}): Promise<SuggestionItem[]> {
	const anchorTokens = extractAnchorTokens(seed);

	const messages = [
		{
			role: 'system',
			content: [
				'You generate focused marketing keywords that help discover U.S.-based social media creators.',
				'Every suggestion must stay tightly aligned with the user seed: preserve the core nouns or swap them only for direct synonyms.',
				'Never drift into unrelated industries or topics.',
				'Produce concise phrases (max 4 words).',
				'Do not emit any keyword that already exists in the provided list.',
			].join(' '),
		},
		{
			role: 'user',
			content: [
				`Seed keyword: "${seed}".`,
				existingKeywords.length
					? `Already selected keywords: ${existingKeywords.join(', ')}.`
					: 'No existing keywords have been selected.',
				platform ? `Preferred platform: ${platform}.` : '',
				planHint ? `Plan tier: ${planHint}.` : '',
				anchorTokens.length
					? `Anchor tokens that must remain visible (or be replaced with tight synonyms): ${anchorTokens.join(', ')}.`
					: '',
				`Return between 5 and ${Math.min(limit, MAX_SUGGESTIONS)} creative keyword ideas that diversify niches, demographics, or intents.`,
			]
				.filter(Boolean)
				.join(' '),
		},
	];

	const body = {
		model: defaultModel,
		stream: true,
		response_format: { type: 'json_schema', json_schema: schema },
		temperature: 0.6,
		top_p: 0.9,
		messages,
	};

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
		},
		body: JSON.stringify(body),
	});

	if (!(response.ok && response.body)) {
		const errorPayload = await response.text().catch(() => 'unknown error');
		throw new Error(`OpenAI suggestion request failed: ${response.status} ${errorPayload}`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let content = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		const segments = buffer.split('\n');
		buffer = segments.pop() ?? '';

		for (const segment of segments) {
			const line = segment.trim();
			if (!line.startsWith('data:')) continue;
			const data = line.slice(5).trim();
			if (!data || data === '[DONE]') {
				continue;
			}
			try {
				const parsed = JSON.parse(data);
				const delta = parsed.choices?.[0]?.delta?.content;
				if (typeof delta === 'string' && delta.length > 0) {
					content += delta;
					emitToken?.(delta);
				}
			} catch {
				// ignore malformed chunk
			}
		}
	}

	if (!content) {
		return [];
	}

	try {
		const parsed = JSON.parse(content) as {
			suggestions?: Array<{ keyword?: string; confidence?: number; rationale?: string }>;
		};
		const suggestions = Array.isArray(parsed?.suggestions) ? parsed!.suggestions : [];
		return suggestions
			.map((entry) => {
				const keyword = sanitizeKeyword(entry.keyword);
				if (!keyword) return null;
				return {
					keyword,
					confidence:
						typeof entry.confidence === 'number'
							? Math.max(0, Math.min(1, entry.confidence))
							: undefined,
					rationale: typeof entry.rationale === 'string' ? entry.rationale.trim() : undefined,
				} as SuggestionItem;
			})
			.filter((entry): entry is SuggestionItem => {
				if (!entry) return false;
				if (!anchorTokens.length) return true;
				const normalized = entry.keyword.toLowerCase();
				return anchorTokens.some((token) => normalized.includes(token));
			})
			.slice(0, limit);
	} catch (error) {
		throw new Error(`Failed to parse structured suggestions: ${(error as Error).message}`);
	}
}

export async function POST(request: Request) {
	if (!process.env.OPENAI_API_KEY) {
		return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
	}

	let body: SuggestionRequestBody;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const seed = sanitizeKeyword(body.seed);
	if (!seed) {
		return NextResponse.json(
			{ error: 'Seed keyword is required and must be at least 3 characters' },
			{ status: 400 }
		);
	}

	const existingKeywords = Array.isArray(body.existingKeywords)
		? body.existingKeywords.map(sanitizeKeyword).filter((value): value is string => value !== null)
		: [];

	const limit = Math.max(
		1,
		Math.min(Number.isFinite(body?.limit) ? Number(body.limit) : 8, MAX_SUGGESTIONS)
	);
	const platform = typeof body?.platform === 'string' ? body.platform : undefined;
	const planHint =
		typeof (request.headers.get('x-plan-tier') ?? '') === 'string'
			? (request.headers.get('x-plan-tier') ?? undefined)
			: undefined;
	const cacheKey = buildCacheKey(seed, platform, planHint);
	const cached = readCache(cacheKey);

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: unknown) => writeEvent(controller, event);
			send({ type: 'start' });

			if (cached && cached.length) {
				for (const item of cached) {
					if (existingKeywords.includes(item.keyword.toLowerCase())) {
						continue;
					}
					send({ type: 'suggestion', payload: item });
				}
				send({ type: 'complete' });
				controller.close();
				return;
			}

			let suggestions: SuggestionItem[] = [];
			try {
				const result = await streamOpenAICompletion({
					seed,
					existingKeywords,
					limit,
					platform,
					planHint,
					emitToken: (token) => {
						if (token && token.trim().length > 0) {
							send({ type: 'token', payload: token });
						}
					},
				});

				const seen = new Set(existingKeywords.map((value) => value.toLowerCase()));
				suggestions = result.filter((item) => {
					if (seen.has(item.keyword.toLowerCase())) {
						return false;
					}
					seen.add(item.keyword.toLowerCase());
					return true;
				});

				for (const item of suggestions) {
					send({ type: 'suggestion', payload: item });
				}

				storeCache(cacheKey, suggestions);
				send({ type: 'complete' });
			} catch (error) {
				send({ type: 'error', message: (error as Error).message });
			} finally {
				controller.close();
			}
		},
		cancel() {
			// nothing to clean up explicitly; upstream fetch is awaited
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		},
	});
}
