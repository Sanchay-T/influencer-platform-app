import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['SCRAPECREATORS_API_KEY', 'SCRAPECREATORS_API_URL'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const apiKey = process.env.SCRAPECREATORS_API_KEY!;
const baseUrl = process.env.SCRAPECREATORS_API_URL!;

const keywordInput = process.env.LEGACY_TIKTOK_KEYWORD ?? 'sustainable fashion';
const maxIterations = Number.parseInt(process.env.LEGACY_TIKTOK_ITERATIONS ?? '1', 10);

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

function writeCsv(searchType: string, platform: string, filenamePrefix: string, metadata: Record<string, unknown>, rows: Record<string, unknown>[], columns: string[]): string {
  const outputDir = path.join(process.cwd(), 'logs', 'search-matrix-legacy', searchType, platform);
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `${filenamePrefix}-${timestamp}.csv`);
  const csv = toCsv(rows, columns);
  const metadataLines = Object.entries(metadata).map(([key, value]) => `# ${key},"${String(value ?? '').replace(/"/g, '""')}"`);
  const fileContents = `${metadataLines.join('\n')}\n\n${csv}`;
  writeFileSync(outputPath, fileContents, 'utf8');
  return outputPath;
}

function extractEmails(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  return text.match(emailRegex) ?? [];
}

function mapResult(item: any) {
  const aweme = item?.aweme_info ?? {};
  const author = aweme?.author ?? {};
  const bio = author?.signature || '';
  const emails = extractEmails(bio);
  return {
    platform: 'TikTok',
    name: author?.nickname || author?.unique_id || 'Unknown Creator',
    username: author?.unique_id || '',
    followers: author?.follower_count ?? '',
    bio,
    emails: emails.join('; '),
    video_title: aweme?.desc || '',
    video_url: aweme?.share_url || '',
    video_views: aweme?.statistics?.play_count ?? '',
    profile_url: author?.unique_id ? `https://www.tiktok.com/@${author.unique_id}` : '',
  };
}

async function run() {
  console.log('🔍 Legacy TikTok search using ScrapeCreators (old pipeline mimic)');
  console.log('📝 Keywords:', keywordInput);
  console.log('🔁 Iterations:', maxIterations);

  let cursor = 0;
  const aggregated: any[] = [];
  let iteration = 0;
  let lastLatency = 0;

  while (iteration < maxIterations) {
    iteration += 1;
    const url = `${baseUrl}?query=${encodeURIComponent(keywordInput)}&cursor=${cursor}`;
    console.log(`🌐 Request #${iteration}:`, url);

    const start = Date.now();
    const response = await fetch(url, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
    });
    lastLatency = Date.now() - start;
    console.log(`⏱️ Latency: ${lastLatency}ms`);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ScrapeCreators request failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    const list = Array.isArray(payload?.search_item_list) ? payload.search_item_list : [];
    console.log(`✅ Returned ${list.length} items (cursor=${payload?.cursor ?? 'n/a'})`);

    aggregated.push(...list.map(mapResult));

    if (!payload?.has_more || typeof payload?.cursor === 'undefined') {
      console.log('🔚 No more cursor provided, stopping.');
      break;
    }

    cursor = Number(payload.cursor) || payload.cursor;
  }

  const columns = ['platform', 'name', 'username', 'followers', 'bio', 'emails', 'video_title', 'video_url', 'video_views', 'profile_url'];
  const metadata = {
    search_type: 'keyword',
    platform: 'tiktok',
    keyword: keywordInput,
    iterations: iteration,
    total_rows: aggregated.length,
    last_cursor: cursor,
    last_latency_ms: lastLatency,
  };

  const csvPath = writeCsv('keyword', 'tiktok', 'legacy-tiktok-keyword', metadata, aggregated, columns);
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ Legacy TikTok search failed');
  console.error(error);
  process.exitCode = 1;
});
