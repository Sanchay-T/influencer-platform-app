import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['SCRAPECREATORS_API_KEY', 'SCRAPECREATORS_INSTAGRAM_API_URL'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const apiKey = process.env.SCRAPECREATORS_API_KEY!;
const baseUrl = process.env.SCRAPECREATORS_INSTAGRAM_API_URL!;

const targetUsername = (process.env.LEGACY_INSTAGRAM_USERNAME ?? 'sustainablefashionforum').replace(/^@/, '');

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

function mapRelatedProfile(profile: any) {
  const username = profile?.username || '';
  return {
    platform: 'Instagram',
    username,
    full_name: profile?.full_name ?? '',
    followers: profile?.followers_count ?? '',
    bio: profile?.biography ?? '',
    emails: Array.isArray(profile?.emails) ? profile.emails.join('; ') : '',
    profile_url: username ? `https://instagram.com/${username}` : '',
    is_verified: profile?.is_verified ? 'Yes' : 'No',
    is_private: profile?.is_private ? 'Yes' : 'No',
  };
}

async function run() {
  console.log('🔍 Legacy Instagram similar (ScrapeCreators related profiles)');
  console.log('👤 Target username:', targetUsername);

  const url = `${baseUrl}?handle=${encodeURIComponent(targetUsername)}`;
  const start = Date.now();
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(20000),
  });
  const latency = Date.now() - start;
  console.log(`⏱️ Latency: ${latency}ms`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ScrapeCreators Instagram profile request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const root = payload?.data?.user;
  const relatedEdges = root?.edge_related_profiles?.edges ?? [];
  console.log('✅ Total related edges:', relatedEdges.length);

  const processed = relatedEdges.map((edge: any) => mapRelatedProfile(edge?.node));

  const metadata = {
    search_type: 'similar',
    platform: 'instagram',
    target_username: targetUsername,
    total_related: processed.length,
    latency_ms: latency,
  };

  const columns = ['platform', 'username', 'full_name', 'followers', 'bio', 'emails', 'profile_url', 'is_verified', 'is_private'];
  const csvPath = writeCsv('similar', 'instagram', 'legacy-instagram-similar', metadata, processed, columns);
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ Legacy Instagram similar search failed');
  console.error(error);
  process.exitCode = 1;
});
