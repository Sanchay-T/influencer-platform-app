import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['MODASH_API_KEY'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const API_KEY = process.env.MODASH_API_KEY!;
const API_URL = 'https://api.modash.io/v1/instagram/search';

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = row[column];
          const value = raw === undefined || raw === null ? '' : String(raw);
          const escaped = value.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    )
    .join('\n');
  return `${header}\n${body}`;
}

function writeCsv(filenamePrefix: string, metadata: Record<string, unknown>, rows: Record<string, unknown>[], columns: string[]): string {
  const outputDir = path.join(process.cwd(), 'logs', 'modash');
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `${filenamePrefix}-${timestamp}.csv`);
  const csv = toCsv(rows, columns);
  const metadataLines = Object.entries(metadata).map(([key, value]) => `# ${key},"${String(value ?? '').replace(/"/g, '""')}"`);
  const fileContents = `${metadataLines.join('\n')}\n\n${csv}`;
  writeFileSync(outputPath, fileContents, 'utf8');
  return outputPath;
}

function flattenResult(item: any): Record<string, unknown> {
  return {
    username: item?.username ?? '',
    fullName: item?.fullName ?? '',
    followers: item?.followers ?? '',
    engagementRate: item?.engagementRate ?? '',
    topics: Array.isArray(item?.topics) ? item.topics.join('; ') : '',
    languages: Array.isArray(item?.languages) ? item.languages.join('; ') : '',
    country: item?.country ?? '',
    accountType: item?.type ?? '',
    lastPostDate: item?.lastPostDate ?? '',
    profileUrl: item?.profileUrl ?? '',
  };
}

async function run() {
  console.log('🔍 Hitting Modash Instagram Search API');

  const payload = {
    sort: {
      field: 'followers',
      direction: 'desc',
    },
    filter: {},
    pagination: {
      limit: 25,
    },
  };

  const start = Date.now();
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const latency = Date.now() - start;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Modash search call failed: ${response.status} ${response.statusText} → ${body}`);
  }

  const data = await response.json();
  const results = Array.isArray(data?.data) ? data.data : [];
  console.log(`✅ Received ${results.length} creators in ${latency}ms`);

  const flattened = results.map(flattenResult);
  const csvPath = writeCsv(
    'modash-instagram-search',
    {
      endpoint: API_URL,
      sort_field: payload.sort.field,
      sort_direction: payload.sort.direction,
      filter: JSON.stringify(payload.filter),
      limit: payload.pagination.limit,
      latency_ms: latency,
      total_returned: results.length,
    },
    flattened,
    ['username', 'fullName', 'followers', 'engagementRate', 'topics', 'languages', 'country', 'accountType', 'lastPostDate', 'profileUrl']
  );

  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ Modash Instagram Search test failed');
  console.error(error);
  process.exitCode = 1;
});
