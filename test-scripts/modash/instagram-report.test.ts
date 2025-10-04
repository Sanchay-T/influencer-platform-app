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
const USER_ID = process.env.TEST_MODASH_INSTAGRAM_USER ?? 'instagram';
const API_URL = `https://api.modash.io/v1/instagram/profile/${encodeURIComponent(USER_ID)}/report`;

function writeJson(filenamePrefix: string, metadata: Record<string, unknown>, payload: unknown): string {
  const outputDir = path.join(process.cwd(), 'logs', 'modash');
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `${filenamePrefix}-${timestamp}.json`);
  const metadataBlock = {
    metadata,
    payload,
  };
  writeFileSync(outputPath, JSON.stringify(metadataBlock, null, 2), 'utf8');
  return outputPath;
}

async function run() {
  console.log(`🔎 Fetching Modash Instagram report for user ${USER_ID}`);

  const start = Date.now();
  const response = await fetch(API_URL, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    signal: AbortSignal.timeout(20000),
  });
  const latency = Date.now() - start;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Modash report call failed: ${response.status} ${response.statusText} → ${body}`);
  }

  const data = await response.json();
  console.log(`✅ Report fetched in ${latency}ms`);

  const jsonPath = writeJson('modash-instagram-report', {
    endpoint: API_URL,
    latency_ms: latency,
    requested_user: USER_ID,
  }, data);

  console.log('💾 Report saved to:', jsonPath);
}

run().catch((error) => {
  console.error('❌ Modash Instagram report test failed');
  console.error(error);
  process.exitCode = 1;
});
