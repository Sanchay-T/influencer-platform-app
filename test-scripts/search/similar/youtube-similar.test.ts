import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { getYouTubeChannelProfile, searchYouTubeWithKeywords } from '../../../lib/platforms/youtube-similar/api';
import { extractSearchKeywords, extractChannelsFromVideos } from '../../../lib/platforms/youtube-similar/transformer';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['SCRAPECREATORS_API_KEY'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const targetHandle = process.env.TEST_YOUTUBE_SIMILAR_HANDLE ?? '@marquesbrownlee';
const normalizedHandle = targetHandle.startsWith('@') ? targetHandle : `@${targetHandle}`;

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

function buildRows(channels: any[], keyword: string) {
  return channels.map((channel) => {
    const handle = channel.handle || channel.id || '';
    const normalized = handle.startsWith('@') ? handle : `@${handle}`;
    const profileUrl = normalized ? `https://www.youtube.com/${normalized}` : '';

    return {
      platform: 'YouTube',
      username: normalized,
      full_name: channel.name || '',
      followers: '',
      bio: `Derived from keyword: ${keyword}`,
      emails: '',
      profile_url: profileUrl,
      is_verified: '',
      is_private: '',
    };
  });
}

async function run() {
  console.log('🔍 Running YouTube similar creator smoke test');
  console.log('👤 Target handle:', normalizedHandle);

  const profileStart = Date.now();
  const profile = await getYouTubeChannelProfile(normalizedHandle);
  const profileLatency = Date.now() - profileStart;
  assert(profile?.handle, 'YouTube channel profile lookup returned no data');

  const keywords = extractSearchKeywords(profile);
  assert(keywords.length > 0, 'Keyword extraction produced no terms');
  console.log('🧠 Derived keywords:', keywords);

  const primaryKeyword = keywords[0];
  const searchStart = Date.now();
  const searchResponse = await searchYouTubeWithKeywords([primaryKeyword]);
  const searchLatency = Date.now() - searchStart;
  const videos = Array.isArray(searchResponse?.videos) ? searchResponse.videos : [];
  assert(videos.length > 0, 'YouTube similar search returned no videos');

  const limitedVideos = videos.slice(0, Math.min(25, videos.length));
  const channels = extractChannelsFromVideos(limitedVideos, normalizedHandle);
  const rows = buildRows(channels, primaryKeyword);
  const metadata = {
    search_type: 'similar',
    platform: 'youtube',
    target_handle: normalizedHandle,
    derived_keyword: primaryKeyword,
    total_candidates: channels.length,
    profile_latency_ms: profileLatency,
    search_latency_ms: searchLatency,
  };
  const csvPath = writeCsv(
    'similar',
    'youtube',
    'youtube-similar',
    metadata,
    rows,
    ['platform', 'username', 'full_name', 'followers', 'bio', 'emails', 'profile_url', 'is_verified', 'is_private']
  );

  console.log('✅ YouTube similar creator search succeeded');
  console.log('📊 Channel count:', channels.length);
  console.log('🎬 Sample rows:', rows.slice(0, 5));
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ YouTube similar creator search test failed');
  console.error(error);
  process.exitCode = 1;
});
