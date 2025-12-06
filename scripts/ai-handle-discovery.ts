#!/usr/bin/env ts-node

/**
 * Quick experiment: ask the LLM for Instagram handles for a given keyword.
 * Usage: npx ts-node --transpile-only scripts/ai-handle-discovery.ts "fitness coach"
 */

import { config as loadEnv } from 'dotenv';
import OpenAI from 'openai';

loadEnv({ path: '.env.local' });

type LLMProvider = 'openrouter' | 'openai';

function createLlmClient():
  | { client: OpenAI; provider: LLMProvider }
  | null {
  const openRouterKey = process.env.OPEN_ROUTER;
  if (openRouterKey) {
    return {
      client: new OpenAI({
        apiKey: openRouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer':
            process.env.OPEN_ROUTER_REFERRER ??
            'https://influencer-platform.vercel.app',
          'X-Title': 'ScrapeCreators Handle Discovery',
        },
      }),
      provider: 'openrouter',
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      client: new OpenAI({ apiKey: openAiKey }),
      provider: 'openai',
    };
  }

  return null;
}

function selectModel(provider: LLMProvider) {
  const configured = process.env.SCRAPECREATORS_FEED_AI_MODEL;
  if (configured) return configured;
  return provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
}

async function main() {
  const keyword = (process.argv[2] ?? '').trim();
  if (!keyword) {
    console.error('Provide a keyword, e.g. "nutritionist"');
    process.exit(1);
  }

  const llm = createLlmClient();
  if (!llm) {
    console.error('No LLM key found (OPEN_ROUTER or OPENAI_API_KEY).');
    process.exit(1);
  }

  const prompt = `
You help identify active Instagram creators.
Return up to 20 unique handles of US-based Instagram creators who regularly publish reels about the keyword below.
Exclude brands, restaurants, gyms, and agencies unless they post personal creator-style reels themselves.
Respond strictly as JSON: {"handles":[{"handle":"...", "why":"...", "confidence":0-1}]}
  `.trim();

  const user = {
    keyword,
    audience: 'United States',
    platform: 'Instagram',
    format: 'reels',
    desired_count: 20,
  };

  const completion = await llm.client.chat.completions.create({
    model: selectModel(llm.provider),
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(user) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? '';
  if (!raw) {
    console.error('Model returned empty response.');
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(raw);
    console.log(JSON.stringify({ keyword, result: parsed }, null, 2));
  } catch (error) {
    console.error('Failed to parse JSON from model:', raw);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Discovery script failed', error);
  process.exit(1);
});
