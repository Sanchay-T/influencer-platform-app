import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { getInstagramProfile, getEnhancedInstagramProfile } from '../../../lib/platforms/instagram-similar/api';
import { transformInstagramProfile, transformEnhancedProfile } from '../../../lib/platforms/instagram-similar/transformer';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['APIFY_TOKEN'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const username = (process.env.TEST_INSTAGRAM_SIMILAR_USERNAME ?? 'natgeo').replace('@', '');

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
  const outputDir = path.join(process.cwd(), 'logs', 'search-matrix', searchType, platform);
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `${filenamePrefix}-${timestamp}.csv`);
  const csv = toCsv(rows, columns);
  const metadataLines = Object.entries(metadata).map(([key, value]) => `# ${key},"${String(value ?? '').replace(/"/g, '""')}"`);
  const fileContents = `${metadataLines.join('\n')}\n\n${csv}`;
  writeFileSync(outputPath, fileContents, 'utf8');
  return outputPath;
}

async function enhanceCreators(creators: any[]) {
  const limit = Math.min(10, creators.length);
  for (let i = 0; i < limit; i++) {
    const creator = creators[i];
    try {
      const enhanced = await getEnhancedInstagramProfile(creator.username);
      if (enhanced.success && enhanced.data) {
        creators[i] = transformEnhancedProfile(creator, enhanced.data);
      }
    } catch (err: any) {
      console.log(`⚠️ [ENHANCED-PROFILE] Failed for @${creator.username}: ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return creators;
}

function buildRows(creators: any[]) {
  return creators.map((entry) => {
    const creator = entry.creator || {};
    const username = entry.username || creator.uniqueId || '';
    const profileUrl = entry.profileUrl || (username ? `https://instagram.com/${username}` : '');
    const emails = entry.emails || creator.emails || [];
    const followers = entry.followers_count ?? creator.followers ?? 0;
    const bio = entry.bio || creator.bio || '';

    return {
      platform: 'Instagram',
      username,
      full_name: entry.full_name || creator.name || '',
      followers,
      bio,
      emails: Array.isArray(emails) ? emails.join('; ') : '',
      profile_url: profileUrl,
      is_verified: entry.is_verified ? 'Yes' : 'No',
      is_private: entry.is_private ? 'Yes' : 'No',
    };
  });
}

async function run() {
  console.log('🔍 Running Instagram similar profile smoke test');
  console.log('👤 Target username:', username);

  const start = Date.now();
  const result = await getInstagramProfile(username);
  const latencyMs = Date.now() - start;
  assert(result.success, `Instagram profile fetch failed: ${result.error ?? 'unknown error'}`);

  const profile = result.data;
  assert(profile, 'Instagram profile response is empty');

  let transformed = transformInstagramProfile(profile);
  assert(transformed.length > 0, 'Instagram similar search returned no related profiles');

  transformed = await enhanceCreators(transformed);
  const limited = transformed.slice(0, Math.min(25, transformed.length));
  const rows = buildRows(limited);
  const metadata = {
    search_type: 'similar',
    platform: 'instagram',
    target_username: username,
    total_related_profiles: transformed.length,
    latency_ms: latencyMs,
  };
  const csvPath = writeCsv(
    'similar',
    'instagram',
    'instagram-similar',
    metadata,
    rows,
    ['platform', 'username', 'full_name', 'followers', 'bio', 'emails', 'profile_url', 'is_verified', 'is_private']
  );

  console.log('✅ Instagram similar profile search succeeded');
  console.log('📊 Total related profiles:', transformed.length);
  console.log('👥 Sample rows:', rows.slice(0, 5));
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ Instagram similar profile search test failed');
  console.error(error);
  process.exitCode = 1;
});
