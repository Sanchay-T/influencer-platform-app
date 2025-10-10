import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { searchYouTubeKeywords } from '../../../lib/platforms/youtube/api';
import { transformYouTubeVideos } from '../../../lib/platforms/youtube/transformer';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['SCRAPECREATORS_API_KEY'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const keywords = (process.env.TEST_YOUTUBE_KEYWORDS ?? 'ai tools, productivity, tech review')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

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

function buildKeywordRows(creators: any[], sourceVideos: any[]) {
  return creators.map((item, index) => {
    const creator = item.creator || {};
    const video = item.video || {};
    const stats = video.statistics || {};
    const source = sourceVideos[index] || {};
    const rawHandle = source?.channel?.handle || source?.channel?.id || creator.uniqueId || '';
    const normalizedHandle = rawHandle
      ? rawHandle.startsWith('@')
        ? rawHandle
        : `@${rawHandle}`
      : '';
    const profileUrl = normalizedHandle ? `https://www.youtube.com/${normalizedHandle}` : '';

    return {
      platform: item.platform,
      name: creator.name || source?.channel?.title || 'N/A',
      username: normalizedHandle,
      followers: creator.followers || 0,
      verified: creator.verified ? 'Yes' : 'No',
      bio: creator.bio || '',
      emails: Array.isArray(creator.emails) ? creator.emails.join('; ') : '',
      video_title: video.description || source?.title || '',
      video_url: video.url || source?.url || '',
      video_views: stats.views || source?.viewCountInt || 0,
      profile_url: profileUrl,
    };
  });
}

async function run() {
  console.log('🔍 Running YouTube keyword search smoke test');
  console.log('📝 Keywords:', keywords);

  const start = Date.now();
  const result = await searchYouTubeKeywords(keywords);
  const latencyMs = Date.now() - start;
  const videos = Array.isArray(result?.videos) ? result.videos : [];
  assert(videos.length > 0, 'YouTube keyword search returned no videos');

  const limitedVideos = videos.slice(0, Math.min(25, videos.length));
  const normalized = transformYouTubeVideos(limitedVideos, keywords);
  const rows = buildKeywordRows(normalized, limitedVideos);
  const metadata = {
    search_type: 'keyword',
    platform: 'youtube',
    keywords: keywords.join(', '),
    total_returned: videos.length,
    latency_ms: latencyMs,
    continuation_token: result?.continuationToken ?? '',
  };
  const csvPath = writeCsv(
    'keyword',
    'youtube',
    'youtube-keyword',
    metadata,
    rows,
    ['platform', 'name', 'username', 'followers', 'verified', 'bio', 'emails', 'video_title', 'video_url', 'video_views', 'profile_url']
  );

  console.log('✅ YouTube keyword search succeeded');
  console.log('📊 Total videos:', videos.length);
  console.log('🎬 Sample rows:', rows.slice(0, 5));
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ YouTube keyword search test failed');
  console.error(error);
  process.exitCode = 1;
});
