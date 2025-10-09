import OpenAI from 'openai';

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

export interface SonarClientOptions {
  apiKey?: string;
  baseURL?: string;
}

export function createSonarClient(options: SonarClientOptions = {}): OpenAI {
  const apiKey =
    options.apiKey ??
    process.env.PERPLEXITY_API_KEY ??
    process.env.PPLX_API_KEY ??
    process.env.PPLX_KEY;

  if (!apiKey) {
    throw new Error('Perplexity API key is not configured.');
  }

  return new OpenAI({
    apiKey,
    baseURL: options.baseURL ?? PERPLEXITY_BASE_URL,
    defaultHeaders: {
      Accept: 'application/json',
    },
  });
}

export function sonarModel(): string {
  return process.env.SONAR_MODEL ?? 'sonar-pro';
}
