import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { getTikTokProfile, searchTikTokUsers } from '../../../lib/platforms/tiktok-similar/api';
import { extractSearchKeywords, transformTikTokUsers } from '../../../lib/platforms/tiktok-similar/transformer';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['SCRAPECREATORS_API_KEY'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const targetHandle = (process.env.TEST_TIKTOK_SIMILAR_HANDLE ?? 'charlidamelio').replace('@', '');

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

function buildRows(creators: any[]) {
  return creators.map((entry) => {
    const creator = entry.creator || {};
    const username = entry.username || creator.uniqueId || '';
    const profileUrl = entry.profileUrl || (username ? `https://www.tiktok.com/@${username}` : '');
    const emails = entry.emails || creator.emails || [];
    const followers = entry.followerCount ?? creator.followers ?? 0;
    const bio = entry.bio || creator.bio || '';

    return {
      platform: 'TikTok',
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
  console.log('🔍 Running TikTok similar creator smoke test');
  console.log('👤 Target handle:', targetHandle);

  const profileStart = Date.now();
  const profile = await getTikTokProfile(targetHandle);
  const profileLatency = Date.now() - profileStart;
  assert(profile?.user?.uniqueId, 'TikTok profile lookup did not return user data');

  const keywords = extractSearchKeywords(profile);
  assert(keywords.length > 0, 'Keyword extraction failed for TikTok profile');
  console.log('🧠 Derived keywords:', keywords);

  const primaryKeyword = keywords[0];
  const searchStart = Date.now();
  const searchResults = await searchTikTokUsers(primaryKeyword);
  const searchLatency = Date.now() - searchStart;
  const users = Array.isArray(searchResults?.users) ? searchResults.users : [];
  assert(users.length > 0, 'TikTok similarity search returned no users');

  const transformed = await transformTikTokUsers(searchResults, primaryKeyword);
  const limited = transformed.slice(0, Math.min(25, transformed.length));
  const rows = buildRows(limited);
  const metadata = {
    search_type: 'similar',
    platform: 'tiktok',
    target_handle: targetHandle,
    derived_keyword: primaryKeyword,
    total_candidates: transformed.length,
    profile_latency_ms: profileLatency,
    search_latency_ms: searchLatency,
  };
  const csvPath = writeCsv(
    'similar',
    'tiktok',
    'tiktok-similar',
    metadata,
    rows,
    ['platform', 'username', 'full_name', 'followers', 'bio', 'emails', 'profile_url', 'is_verified', 'is_private']
  );

  console.log('✅ TikTok similar creator search succeeded');
  console.log('📊 User count:', users.length);
  console.log('👥 Sample rows:', rows.slice(0, 5));
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ TikTok similar creator search test failed');
  console.error(error);
  process.exitCode = 1;
});
