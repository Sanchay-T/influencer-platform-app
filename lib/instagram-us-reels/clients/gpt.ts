import OpenAI from 'openai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface GptClientOptions {
  apiKey?: string;
  baseURL?: string;
}

function resolveGptApiKey(options: GptClientOptions = {}): { apiKey: string; baseURL?: string } | null {
  if (options.apiKey) {
    return { apiKey: options.apiKey, baseURL: options.baseURL };
  }

  const openRouterKey =
    process.env.OPENROUTER_API_KEY ??
    process.env.OPENROUTER_KEY ??
    process.env.OPEN_ROUTER ??
    process.env.OPEN_ROUTER_API_KEY;
  if (openRouterKey) {
    return {
      apiKey: openRouterKey,
      baseURL: options.baseURL ?? OPENROUTER_BASE_URL,
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      apiKey: openAiKey,
      baseURL: options.baseURL,
    };
  }

  return null;
}

export function createGptClient(options: GptClientOptions = {}): OpenAI | null {
  const config = resolveGptApiKey(options);
  if (!config) return null;

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

export function gptModel(): string {
  return process.env.GPT_MODEL ?? 'gpt-4o';
}
