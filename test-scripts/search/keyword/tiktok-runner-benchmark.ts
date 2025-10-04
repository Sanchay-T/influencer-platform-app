import path from 'node:path';
import assert from 'node:assert/strict';
import { config as loadEnv } from 'dotenv';
import { buildTestAuthHeaders } from '../../../lib/auth/testable-auth';

loadEnv({ path: path.join(process.cwd(), '.env.development') });
loadEnv({ path: path.join(process.cwd(), '.env.local') });

const REQUIRED_VARS = ['TEST_AUTH_SECRET', 'SCRAPECREATORS_API_KEY', 'SCRAPECREATORS_API_URL'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const BASE_URL =
  process.env.TEST_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const testUserId = process.env.TEST_SEARCH_USER_ID || 'search-runner-tester';
const testUserEmail = `${testUserId}@example.com`;

function authHeaders() {
  const headers = buildTestAuthHeaders({ userId: testUserId, email: testUserEmail });
  return {
    ...headers,
    'content-type': 'application/json',
  };
}

async function createCampaign(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/campaigns`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: `Runner Benchmark ${new Date().toISOString()}`,
      description: 'Temporary campaign for search runner benchmark',
      searchType: 'keyword',
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Campaign creation failed: ${res.status} ${res.statusText} -> ${errorBody}`);
  }

  const payload = await res.json();
  const campaignId = payload?.campaign?.id || payload?.id;
  if (!campaignId) {
    throw new Error('Campaign creation response missing id');
  }
  return campaignId;
}

async function startTikTokSearch(campaignId: string) {
  const keywords = (process.env.TEST_TIKTOK_KEYWORD ?? 'clean beauty influencers').split(',').map((k) => k.trim());
  const res = await fetch(`${BASE_URL}/api/scraping/tiktok`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      keywords,
      targetResults: Number.parseInt(process.env.TEST_TIKTOK_TARGET ?? '100', 10),
      campaignId,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`TikTok search start failed: ${res.status} ${res.statusText} -> ${errorBody}`);
  }

  const payload = await res.json();
  const jobId = payload?.jobId;
  if (!jobId) {
    throw new Error('TikTok search response missing jobId');
  }
  return jobId;
}

async function triggerProcessing(jobId: string) {
  const res = await fetch(`${BASE_URL}/api/qstash/process-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Process-search call failed: ${res.status} ${res.statusText} -> ${body}`);
  }
  return res.json();
}

async function pollJob(jobId: string) {
  const pollIntervalMs = Number.parseInt(process.env.TEST_POLL_INTERVAL_MS ?? '3000', 10);
  const pollTimeoutMs = Number.parseInt(process.env.TEST_POLL_TIMEOUT_MS ?? '60000', 10);
  const startedAt = Date.now();

  while (true) {
    await triggerProcessing(jobId);
    const res = await fetch(`${BASE_URL}/api/scraping/tiktok?jobId=${jobId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Job poll failed: ${res.status} ${res.statusText} -> ${body}`);
    }
    const payload = await res.json();
    const status = payload?.status;
    if (!status) {
      throw new Error('Job poll response missing status');
    }

    if (status !== 'pending' && status !== 'processing') {
      return {
        payload,
        elapsedMs: Date.now() - startedAt,
      };
    }

    if (Date.now() - startedAt > pollTimeoutMs) {
      throw new Error(`Polling timed out after ${pollTimeoutMs} ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

async function run() {
  console.log('🔐 Using base URL:', BASE_URL);
  console.log('👤 Test user:', testUserId);

  const campaignId = await createCampaign();
  console.log('📦 Created campaign:', campaignId);

  const jobStart = Date.now();
  const jobId = await startTikTokSearch(campaignId);
  console.log('🚀 Started TikTok job:', jobId);

  const { payload, elapsedMs } = await pollJob(jobId);
  console.log('⏱️ Total job time (ms):', elapsedMs);
  console.log('📊 Job status:', payload.status);
  console.log('👥 Processed results:', payload.processedResults);
  console.log('📈 Progress:', payload.progress);
  console.log('🧪 Benchmark:', payload.benchmark);

  const totalDuration = Date.now() - jobStart;
  console.log('✅ End-to-end duration (ms):', totalDuration);
  console.log('✅ Benchmark script completed successfully');
}

run().catch((error) => {
  console.error('❌ Benchmark script failed');
  console.error(error);
  process.exitCode = 1;
});
