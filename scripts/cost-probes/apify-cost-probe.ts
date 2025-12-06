#!/usr/bin/env tsx
/**
 * [CostProbe|Apify] Runs a single Apify actor invocation and reports compute unit + USD usage.
 * Coupling: manual CLI entry point (`npx tsx scripts/cost-probes/apify-cost-probe.ts`).
 * Downstream: feed the JSON output into finance tooling to reconcile Apify invoices.
 */

import 'dotenv/config';
import { ApifyClient } from 'apify-client';

interface CliOptions {
  actorId: string;
  input?: string;
  verbose: boolean;
  sampleLimit: number;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {};

  for (const raw of args) {
    const [key, ...rest] = raw.split('=');
    const value = rest.join('=') || '';
    switch (key) {
      case '--actor':
      case '--actorId':
        options.actorId = value;
        break;
      case '--input':
        options.input = value;
        break;
      case '--limit':
      case '--sample-limit':
        options.sampleLimit = Number(value);
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
    actorId: options.actorId ?? process.env.APIFY_ACTOR_ID ?? '',
    input: options.input,
    verbose: options.verbose ?? false,
    sampleLimit: options.sampleLimit && Number.isFinite(options.sampleLimit)
      ? Math.max(1, options.sampleLimit)
      : 100,
  };
}

function printUsageAndExit(): never {
  console.log(`
Run a live Apify actor and surface any compute usage Apify returns.

Usage:
  npx tsx scripts/cost-probes/apify-cost-probe.ts --actor=yourActorId --input='{"keywords":["fitness"],"maxItems":20}'

Flags:
  --actor / --actorId   Actor ID (defaults to APIFY_ACTOR_ID env)
  --input               JSON string forwarded as actor input (defaults to {})
  --verbose             Dump full run + dataset metadata (default false)
`);
  process.exit(0);
}

interface ProbeResult {
  request: {
    actorId: string;
  };
  summary: {
    runId: string;
    status: string;
    computeUnits?: number;
    totalUsageUsd?: number;
    startedAt?: string;
    finishedAt?: string;
    datasetItemCount?: number;
    pricePerUnitUsd?: number;
    estimatedCostUsd?: number;
  };
  usage?: unknown;
  datasetSample?: unknown;
}

async function run() {
  const opts = parseArgs();

  const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error('Missing APIFY_TOKEN. Populate your environment before running the probe.');
  }

  if (!opts.actorId) {
    throw new Error('Actor ID is required. Pass --actor=... or set APIFY_ACTOR_ID.');
  }

  let parsedInput: unknown = {};
  if (opts.input) {
    try {
      parsedInput = JSON.parse(opts.input);
    } catch {
      throw new Error(`Actor input must be valid JSON. Received: ${opts.input}`);
    }
  }

  const client = new ApifyClient({ token });

  const run = await client.actor(opts.actorId).call(parsedInput);
  const runDetails = await client.run(run.id).get();
  const usageSummary = (runDetails as any)?.usage ?? {};

  const startedAt =
    runDetails?.startedAt instanceof Date
      ? runDetails.startedAt.toISOString()
      : typeof runDetails?.startedAt === 'string'
      ? runDetails.startedAt
      : undefined;
  const finishedAt =
    runDetails?.finishedAt instanceof Date
      ? runDetails.finishedAt.toISOString()
      : typeof runDetails?.finishedAt === 'string'
      ? runDetails.finishedAt
      : undefined;

  const stats = runDetails?.stats ?? {};
  const pricingInfo = runDetails?.pricingInfo ?? {};

  const datasetClient = runDetails?.defaultDatasetId
    ? client.dataset(runDetails.defaultDatasetId)
    : null;

  let datasetSample: unknown;
  let itemCount: number | undefined;
  if (datasetClient) {
    const datasetItems = await datasetClient.listItems({ limit: opts.sampleLimit });
    itemCount =
      (typeof datasetItems.total === 'number' && datasetItems.total > 0
        ? datasetItems.total
        : datasetItems.items.length) || undefined;
    datasetSample = opts.verbose ? datasetItems.items : undefined;
  }

  const pricePerUnit =
    typeof pricingInfo?.pricePerUnitUsd === 'number'
      ? pricingInfo.pricePerUnitUsd
      : undefined;

  const estimatedCost =
    pricePerUnit && typeof itemCount === 'number'
      ? Number((pricePerUnit * itemCount).toFixed(6))
      : undefined;

  const result: ProbeResult = {
    request: { actorId: opts.actorId },
    summary: {
      runId: runDetails?.id ?? run.id,
      status: runDetails?.status ?? run.status,
      computeUnits:
        typeof usageSummary.totalComputeUnits === 'number'
          ? usageSummary.totalComputeUnits
          : typeof usageSummary.computeUnits === 'number'
          ? usageSummary.computeUnits
          : typeof stats.computeUnits === 'number'
          ? stats.computeUnits
          : undefined,
      totalUsageUsd:
        typeof usageSummary.totalUsd === 'number'
          ? usageSummary.totalUsd
          : typeof usageSummary.totalUsageUsd === 'number'
          ? usageSummary.totalUsageUsd
          : undefined,
      startedAt,
      finishedAt,
      datasetItemCount: itemCount,
      pricePerUnitUsd: pricePerUnit,
      estimatedCostUsd: estimatedCost,
    },
    usage: opts.verbose ? usageSummary : undefined,
    datasetSample,
  };

  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error('❌ Apify cost probe failed:', error.message);
  if (process.env.DEBUG || process.argv.includes('--verbose')) {
    console.error(error);
  }
  process.exit(1);
});
