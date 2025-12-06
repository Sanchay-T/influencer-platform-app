#!/usr/bin/env tsx
/**
 * [CostProbe|ScrapeCreators] Standalone probe to call a ScrapeCreators endpoint and log any cost/credit hints.
 * Coupling: invoked manually via `npx tsx scripts/cost-probes/scrapecreators-cost-probe.ts`.
 * Downstream: finance reporting can consume the emitted JSON payload for spend reconciliation.
 */

import 'dotenv/config';
import axios, { AxiosError } from 'axios';

type HttpMethod = 'GET' | 'POST';

interface CliOptions {
  endpoint: string;
  method: HttpMethod;
  payload?: string;
  verbose: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {};

  for (const raw of args) {
    const [key, ...rest] = raw.split('=');
    const value = rest.join('=') || '';
    switch (key) {
      case '--endpoint':
        options.endpoint = value;
        break;
      case '--method':
        options.method = (value.toUpperCase() as HttpMethod) || 'GET';
        break;
      case '--payload':
        options.payload = value;
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
    endpoint: options.endpoint ?? '/v1/instagram/post',
    method: options.method ?? 'GET',
    payload: options.payload,
    verbose: options.verbose ?? false,
  };
}

function printUsageAndExit(): never {
  console.log(`
Run a live ScrapeCreators request and capture any returned cost metadata.

Usage:
  npx tsx scripts/cost-probes/scrapecreators-cost-probe.ts --endpoint=/v1/instagram/post --method=GET \\
    --payload='{"url":"https://www.instagram.com/reel/..."}'

Flags:
  --endpoint   Relative path like /v1/instagram/post (defaults to /v1/instagram/post)
  --method     GET | POST (default GET)
  --payload    JSON payload for POST requests (stringified)
  --verbose    Print full headers + body (default false)
`);
  process.exit(0);
}

interface ProbeResult {
  request: {
    url: string;
    method: HttpMethod;
  };
  summary: {
    status: number;
    durationMs: number;
    creditHeaders: Record<string, string | undefined>;
    costFields: Record<string, unknown>;
  };
  headers?: Record<string, string>;
  body?: unknown;
}

async function run() {
  const opts = parseArgs();

  const apiKey =
    process.env.SCRAPECREATORS_API_KEY ||
    process.env.SC_API_KEY ||
    process.env.SCRAPECREATORS_TOKEN;

  if (!apiKey) {
    throw new Error(
      'Missing SCRAPECREATORS_API_KEY (or SC_API_KEY). Add it to your environment before running the probe.',
    );
  }

  const baseUrl =
    process.env.SCRAPECREATORS_INSTAGRAM_API_URL ||
    process.env.SCRAPECREATORS_API_URL ||
    'https://api.scrapecreators.com';

  const url = opts.endpoint.startsWith('http')
    ? opts.endpoint
    : `${baseUrl.replace(/\/$/, '')}${opts.endpoint}`;

  const started = Date.now();
  let parsedPayload: unknown;
  if (opts.method === 'POST' && opts.payload) {
    try {
      parsedPayload = JSON.parse(opts.payload);
    } catch (error) {
      throw new Error(`Payload must be valid JSON. Received: ${opts.payload}`);
    }
  }

  try {
    const response = await axios.request({
      url,
      method: opts.method,
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      timeout: 30_000,
      data: parsedPayload,
      validateStatus: () => true,
    });

    const durationMs = Date.now() - started;

    const creditHeaders: Record<string, string | undefined> = {};
    for (const [header, value] of Object.entries(response.headers)) {
      if (/(credit|usage|cost|balance)/i.test(header)) {
        creditHeaders[header] = Array.isArray(value) ? value.join(',') : String(value);
      }
    }

    const costFields: Record<string, unknown> = {};
    if (response.data && typeof response.data === 'object') {
      for (const [key, value] of Object.entries(response.data as Record<string, unknown>)) {
        if (/(cost|credit|usage)/i.test(key)) {
          costFields[key] = value;
        }
      }
    }

    const result: ProbeResult = {
      request: { url, method: opts.method },
      summary: {
        status: response.status,
        durationMs,
        creditHeaders,
        costFields,
      },
      headers: opts.verbose
        ? Object.fromEntries(
            Object.entries(response.headers).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join(',') : String(v),
            ]),
          )
        : undefined,
      body: opts.verbose ? response.data : undefined,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const durationMs = Date.now() - started;
      const creditHeaders: Record<string, string | undefined> = {};
      for (const [header, value] of Object.entries(error.response.headers)) {
        if (/(credit|usage|cost|balance)/i.test(header)) {
          creditHeaders[header] = Array.isArray(value) ? value.join(',') : String(value);
        }
      }

      const costFields: Record<string, unknown> = {};
      if (error.response.data && typeof error.response.data === 'object') {
        for (const [key, value] of Object.entries(error.response.data as Record<string, unknown>)) {
          if (/(cost|credit|usage)/i.test(key)) {
            costFields[key] = value;
          }
        }
      }

      const result: ProbeResult = {
        request: { url, method: opts.method },
        summary: {
          status: error.response.status,
          durationMs,
          creditHeaders,
          costFields,
        },
        headers: opts.verbose
          ? Object.fromEntries(
              Object.entries(error.response.headers).map(([k, v]) => [
                k,
                Array.isArray(v) ? v.join(',') : String(v),
              ]),
            )
          : undefined,
        body: opts.verbose ? error.response.data : undefined,
      };

      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    throw error;
  }
}

run().catch((error) => {
  console.error('❌ ScrapeCreators cost probe failed:', error.message);
  if (process.env.DEBUG || process.argv.includes('--verbose')) {
    console.error(error);
  }
  process.exit(1);
});
