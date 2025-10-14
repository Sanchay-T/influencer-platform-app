#!/usr/bin/env tsx
/**
 * [CostProbe|OpenAI] Executes a lightweight OpenAI chat call and reports token usage + estimated USD cost.
 * Coupling: manual CLI utility; downstream finance tooling can consume the JSON output for reconciliation.
 */

import 'dotenv/config';
import OpenAI from 'openai';

interface CliOptions {
  model: string;
  prompt: string;
  maxTokens: number;
  verbose: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {};

  for (const raw of args) {
    const [key, ...rest] = raw.split('=');
    const value = rest.join('=') || '';
    switch (key) {
      case '--model':
        options.model = value;
        break;
      case '--prompt':
        options.prompt = value;
        break;
      case '--max-tokens':
      case '--maxTokens':
        options.maxTokens = Number(value);
        break;
      case '--verbose':
        options.verbose = value !== 'false';
        break;
      case '--help':
        printUsageAndExit();
        break;
      default:
        if (key.startsWith('--')) {
          console.warn(`⚠️  Unknown flag "${key}" ignored`);
        }
    }
  }

  return {
    model: options.model ?? process.env.OPENAI_COST_MODEL ?? 'gpt-4o-mini',
    prompt:
      options.prompt ??
      'Summarize our influencer keyword search pipeline in two sentences for a finance audience.',
    maxTokens: options.maxTokens ?? 256,
    verbose: options.verbose ?? false,
  };
}

function printUsageAndExit(): never {
  console.log(`
Call OpenAI (Responses API) and compute the estimated USD cost from token usage.

Usage:
  npx tsx scripts/cost-probes/openai-cost-probe.ts --model=gpt-4o-mini --prompt="Hello" --max-tokens=128

Flags:
  --model        OpenAI model (default gpt-4o-mini)
  --prompt       User prompt (default finance-friendly summary prompt)
  --max-tokens   Max completion tokens (default 256)
  --verbose      Include full response payload (default false)
`);
  process.exit(0);
}

type RateTable = Record<
  string,
  {
    inputPerMTokens: number;
    outputPerMTokens: number;
  }
>;

// Rates pulled from OpenAI pricing table (USD per 1M tokens). Keep this map updated manually.
const RATE_TABLE: RateTable = {
  'gpt-4o-mini': { inputPerMTokens: 0.60, outputPerMTokens: 2.40 },
  'gpt-4.1-mini': { inputPerMTokens: 3.00, outputPerMTokens: 12.00 },
  'gpt-4o': { inputPerMTokens: 5.00, outputPerMTokens: 15.00 },
  'gpt-4.1': { inputPerMTokens: 15.00, outputPerMTokens: 60.00 },
  'gpt-4o-realtime-preview': { inputPerMTokens: 10.00, outputPerMTokens: 30.00 },
};

interface ProbeResult {
  request: {
    model: string;
    promptPreview: string;
    maxTokens: number;
  };
  summary: {
    id: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
    rateNote?: string;
  };
  response?: unknown;
}

function computeCost(model: string, promptTokens: number, completionTokens: number) {
  const rates = RATE_TABLE[model];
  if (!rates) {
    return {
      estimatedCostUsd: undefined,
      rateNote: `No rate data for model "${model}". Update RATE_TABLE to compute cost.`,
    };
  }

  const promptCost = (promptTokens / 1_000_000) * rates.inputPerMTokens;
  const completionCost = (completionTokens / 1_000_000) * rates.outputPerMTokens;

  return {
    estimatedCostUsd: Number((promptCost + completionCost).toFixed(6)),
    rateNote: `Rates used: $${rates.inputPerMTokens}/MTok input, $${rates.outputPerMTokens}/MTok output.`,
  };
}

async function run() {
  const opts = parseArgs();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY. Add it to your environment before running the probe.');
  }

  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: opts.model,
    input: [
      {
        role: 'system',
        content:
          'You are a precise finance analyst. Produce concise outputs suitable for cost tracking validations.',
      },
      {
        role: 'user',
        content: opts.prompt,
      },
    ],
    max_output_tokens: opts.maxTokens,
  });

  const usage = response.usage ?? {
    input_tokens: response?.output?.[0]?.usage?.input_tokens ?? 0,
    output_tokens: response?.output?.[0]?.usage?.output_tokens ?? 0,
  };

  const promptTokens = usage?.input_tokens ?? 0;
  const completionTokens = usage?.output_tokens ?? 0;
  const totalTokens = (usage?.total_tokens as number | undefined) ?? promptTokens + completionTokens;

  const costInfo = computeCost(opts.model, promptTokens, completionTokens);

  const result: ProbeResult = {
    request: {
      model: opts.model,
      promptPreview: opts.prompt.slice(0, 120),
      maxTokens: opts.maxTokens,
    },
    summary: {
      id: response.id,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: costInfo.estimatedCostUsd,
      rateNote: costInfo.rateNote,
    },
    response: opts.verbose ? response : undefined,
  };

  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error('❌ OpenAI cost probe failed:', error.message);
  if (process.env.DEBUG || process.argv.includes('--verbose')) {
    console.error(error);
  }
  process.exit(1);
});
