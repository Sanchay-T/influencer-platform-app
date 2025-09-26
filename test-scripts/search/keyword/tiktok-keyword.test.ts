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
const apiUrl = process.env.SCRAPECREATORS_API_URL!;

const keywordInput = process.env.TEST_TIKTOK_KEYWORD ?? 'beauty influencer';
const cursor = Number.parseInt(process.env.TEST_TIKTOK_CURSOR ?? '0', 10);

const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;

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

async function fetchTikTokProfile(handle: string) {
  const profileUrl = `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(handle)}&region=US`;
  const res = await fetch(profileUrl, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Profile fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function transformKeywordResult(item: any) {
  const awemeInfo = item?.aweme_info ?? {};
  const author = awemeInfo?.author ?? {};
  const initialBio = author.signature || '';

  let bio = initialBio;
  let emails: string[] = [];

  if (!bio && author.unique_id) {
    try {
      const profile = await fetchTikTokProfile(author.unique_id);
      const signature = profile.user?.signature ?? '';
      if (signature.length > bio.length) {
        bio = signature;
      }
    } catch (err: any) {
      console.log(`⚠️ [PROFILE-FETCH] Failed for @${author.unique_id}: ${err.message}`);
    }
  }

  emails = bio ? bio.match(emailRegex) ?? [] : [];

  const avatarUrl = author.avatar_medium?.url_list?.[0] || author.avatar_thumb?.url_list?.[0] || '';

  return {
    platform: 'TikTok',
    creator: {
      name: author.nickname || author.unique_id || 'Unknown Creator',
      followers: author.follower_count || 0,
      avatarUrl,
      profilePicUrl: avatarUrl,
      bio,
      emails,
      uniqueId: author.unique_id || '',
      username: author.unique_id || '',
      verified: !!author.verified || !!author.is_verified,
    },
    video: {
      description: awemeInfo.desc || 'No description',
      url: awemeInfo.share_url || '',
      statistics: {
        likes: awemeInfo.statistics?.digg_count || 0,
        comments: awemeInfo.statistics?.comment_count || 0,
        views: awemeInfo.statistics?.play_count || 0,
        shares: awemeInfo.statistics?.share_count || 0,
      },
    },
  };
}

function buildKeywordRows(creators: any[]) {
  return creators.map((item) => {
    const creator = item.creator || {};
    const video = item.video || {};
    const stats = video.statistics || {};
    const username = creator.username || creator.uniqueId || '';
    const profileUrl = username ? `https://www.tiktok.com/@${username}` : '';

    return {
      platform: item.platform,
      name: creator.name || 'N/A',
      username,
      followers: creator.followers || 0,
      verified: creator.verified ? 'Yes' : 'No',
      bio: creator.bio || '',
      emails: Array.isArray(creator.emails) ? creator.emails.join('; ') : '',
      video_title: video.description || '',
      video_url: video.url || '',
      video_views: stats.views || 0,
      profile_url: profileUrl,
    };
  });
}

async function run() {
  console.log('🔍 Running TikTok keyword search smoke test');
  console.log('📝 Keywords:', keywordInput);

  const requestUrl = `${apiUrl}?query=${encodeURIComponent(keywordInput)}&cursor=${cursor}&region=US`;
  const start = Date.now();
  const response = await fetch(requestUrl, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(30000),
  });
  const durationMs = Date.now() - start;
  console.log('⏱️ ScrapeCreators latency (ms):', durationMs);

  assert(response.ok, `TikTok keyword API failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();

  const items = Array.isArray(payload?.search_item_list) ? payload.search_item_list : [];
  assert(items.length > 0, 'TikTok keyword search returned no items');

  const topItems = items.slice(0, Math.min(25, items.length));
  const transformed = [] as any[];
  for (const item of topItems) {
    transformed.push(await transformKeywordResult(item));
  }

  const rows = buildKeywordRows(transformed);
  const metadata = {
    search_type: 'keyword',
    platform: 'tiktok',
    keyword: keywordInput,
    cursor,
    total_returned: items.length,
    latency_ms: durationMs,
  };
  const csvPath = writeCsv(
    'keyword',
    'tiktok',
    'tiktok-keyword',
    metadata,
    rows,
    ['platform', 'name', 'username', 'followers', 'verified', 'bio', 'emails', 'video_title', 'video_url', 'video_views', 'profile_url']
  );

  console.log('✅ TikTok keyword search succeeded');
  console.log('📊 Total items:', items.length);
  console.log('👥 Sample creators:', rows.slice(0, 5));
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ TikTok keyword search test failed');
  console.error(error);
  process.exitCode = 1;
});
