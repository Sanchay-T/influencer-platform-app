import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(process.cwd(), '.env.development') });

const REQUIRED_VARS = ['RAPIDAPI_INSTAGRAM_KEY'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY!;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const keyword = process.env.TEST_INSTAGRAM_KEYWORD ?? 'nike sneakers';
const resultsPerKeyword = Number.parseInt(process.env.TEST_INSTAGRAM_COUNT ?? '20', 10);

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

type NormalizedInstagramCreator = {
  platform: string;
  creator: {
    uniqueId: string;
    username: string;
    name: string;
    followers: number;
    verified: boolean;
    bio: string;
    emails: string[];
    profilePicUrl: string;
    avatarUrl: string;
    externalUrl?: string;
    category?: string;
    private: boolean;
    mediaCount: number;
  };
  video?: {
    description: string;
    url: string;
    statistics: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
    };
  };
};

function deriveReelUrl(media: any): string {
  const code = media?.code || media?.id || media?.pk || media?.video_version_id;
  if (typeof code === 'string' && code.length > 0) {
    return `https://www.instagram.com/reel/${code.replace(/^https?:\/\//, '')}/`;
  }
  const reelUrl = media?.share_url || media?.permalink || media?.link;
  if (typeof reelUrl === 'string') return reelUrl;
  return '';
}

function deriveViewCount(media: any): number {
  const playCount = media?.play_count ?? media?.video_view_count ?? media?.view_count;
  if (typeof playCount === 'number') return playCount;
  return 0;
}

function normalizeInstagramCreators(clips: any[]): NormalizedInstagramCreator[] {
  return clips.map((clip) => {
    const media = clip?.media ?? {};
    const user = media?.user ?? {};
    const username = user?.username ?? '';
    const bio = user?.biography ?? '';
    const emails = bio ? bio.match(emailRegex) ?? [] : [];

    return {
      platform: 'Instagram',
      creator: {
        uniqueId: username,
        username,
        name: user?.full_name || username || 'N/A',
        followers: user?.follower_count || 0,
        verified: !!user?.is_verified,
        bio,
        emails,
        profilePicUrl: user?.profile_pic_url || '',
        avatarUrl: user?.profile_pic_url || '',
        externalUrl: user?.external_url || undefined,
        category: user?.category || undefined,
        private: !!user?.is_private,
        mediaCount: user?.media_count || 0,
      },
      video: {
        description: media?.caption?.text || 'No description',
        url: deriveReelUrl(media),
        statistics: {
          views: deriveViewCount(media),
          likes: media?.like_count || 0,
          comments: media?.comment_count || 0,
          shares: media?.share_count || 0,
        },
      },
    };
  });
}

function buildKeywordRows(creators: NormalizedInstagramCreator[]) {
  return creators.map((item) => {
    const creator = item.creator || {};
    const username = creator.username || creator.uniqueId || '';
    const profileUrl = username ? `https://instagram.com/${username}` : '';
    const video = item.video || {};
    const stats = video.statistics || {};

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
  console.log('🔍 Running Instagram enhanced keyword search smoke test');
  console.log('📝 Keyword:', keyword);

  const count = Math.min(Math.max(resultsPerKeyword, 10), 50);
  const url = `${BASE_URL}/v2/search/reels?query=${encodeURIComponent(keyword)}&count=${count}`;

  const start = Date.now();
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  const durationMs = Date.now() - start;
  console.log('⏱️ RapidAPI latency (ms):', durationMs);

  assert(response.ok, `Instagram reels API failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();

  const modules = Array.isArray(payload?.reels_serp_modules) ? payload.reels_serp_modules : [];
  const clips: any[] = [];
  for (const module of modules) {
    if (module?.module_type === 'clips' && Array.isArray(module.clips)) {
      clips.push(...module.clips);
    }
  }

  assert(clips.length > 0, 'Instagram enhanced search returned no clips');

  const normalized = normalizeInstagramCreators(clips.slice(0, Math.min(25, clips.length)));
  const rows = buildKeywordRows(normalized);
  const metadata = {
    search_type: 'keyword',
    platform: 'instagram',
    keyword,
    results_requested: count,
    total_returned: clips.length,
    latency_ms: durationMs,
  };
  const csvPath = writeCsv(
    'keyword',
    'instagram',
    'instagram-enhanced-keyword',
    metadata,
    rows,
    ['platform', 'name', 'username', 'followers', 'verified', 'bio', 'emails', 'video_title', 'video_url', 'video_views', 'profile_url']
  );

  console.log('✅ Instagram enhanced keyword search succeeded');
  console.log('📊 Total clips:', clips.length);
  console.log('👥 Sample creators:', rows.slice(0, 5));
  console.log('💾 CSV saved to:', csvPath);
}

run().catch((error) => {
  console.error('❌ Instagram enhanced keyword search test failed');
  console.error(error);
  process.exitCode = 1;
});
