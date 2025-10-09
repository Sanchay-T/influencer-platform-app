import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

type Platform = 'instagram' | 'youtube' | 'tiktok' | 'twitch' | 'twitter' | 'onlyfans';

type DiscoveryRequest = {
  platform: Platform;
  paging: { limit: number; page: number };
  sort: { sort_by: 'relevancy' | 'engagement_rate' | 'number_of_followers'; sort_order: 'asc' | 'desc' };
  filters: Record<string, unknown>;
};

type DiscoveryAccount = { user_id: string; profile: Record<string, unknown>; [key: string]: unknown };

type DiscoveryResponse = { total: number | null; limit: number | null; credits_left: string; accounts: DiscoveryAccount[]; [key: string]: unknown };

type Scenario = { name: string; description: string; platform?: Platform; patch: Partial<DiscoveryRequest> };

type ScenarioDefinition = { name: string; description: string; platform?: Platform; patch?: Partial<DiscoveryRequest>; keyPath?: string; value?: unknown };

// Breadcrumb 1: ensure env mirrors Next runtime to keep credentials consistent.
loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
const API_KEY = process.env.INFLUENCERS_CLUB_API_KEY;
if (!API_KEY) {
  console.error('Missing INFLUENCERS_CLUB_API_KEY in .env.local');
  process.exit(1);
}

// Breadcrumb 2: base payload anchors the nutritionists query shared by every scenario.
const baseRequest: DiscoveryRequest = {
  platform: 'instagram',
  paging: { limit: Number(process.env.DISCOVERY_LIMIT ?? 10), page: 0 },
  sort: { sort_by: 'relevancy', sort_order: 'desc' },
  filters: { ai_search: 'nutritionists' },
};

// Breadcrumb 3: set up structured log directory for later analysis replay.
const timestamp = new Date().toISOString().replaceAll(':', '-');
const outputRoot = path.join(process.cwd(), 'logs', 'discovery-api', timestamp);
fs.mkdirSync(outputRoot, { recursive: true });

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const next = (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) ? target[key] as Record<string, unknown> : {};
      target[key] = deepMerge(next, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function buildPatchFromKeyPath(keyPath: string, value: unknown): Partial<DiscoveryRequest> {
  const keys = keyPath.split('.');
  const root: Record<string, unknown> = {};
  let cursor = root;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
    } else {
      cursor[key] = cursor[key] ?? {};
      cursor = cursor[key] as Record<string, unknown>;
    }
  });
  return root as Partial<DiscoveryRequest>;
}

function scenarioFromDefinition(def: ScenarioDefinition): Scenario {
  const patch = def.patch ?? (def.keyPath ? buildPatchFromKeyPath(def.keyPath, def.value) : {});
  return { name: def.name, description: def.description, platform: def.platform, patch };
}

const platformBaselines: ScenarioDefinition[] = [
  { name: 'baseline-instagram', description: 'Instagram relevancy baseline for nutritionists.' },
  { name: 'baseline-tiktok', description: 'TikTok baseline for nutritionists.', platform: 'tiktok' },
  { name: 'baseline-youtube', description: 'YouTube baseline for nutritionists.', platform: 'youtube' },
  { name: 'baseline-twitter', description: 'Twitter baseline for nutritionists.', platform: 'twitter' },
  { name: 'baseline-twitch', description: 'Twitch baseline for nutritionists.', platform: 'twitch' },
  { name: 'baseline-onlyfans', description: 'OnlyFans baseline for nutritionists.', platform: 'onlyfans' },
];

const instagramFilterDefs: ScenarioDefinition[] = [
  { name: 'instagram-type-business', description: 'Profiles tagged as business accounts.', keyPath: 'filters.type', value: 'business' },
  { name: 'instagram-location-us', description: 'Location includes United States.', keyPath: 'filters.location', value: ['United States'] },
  { name: 'instagram-location-nyc', description: 'Location includes Manhattan, New York.', keyPath: 'filters.location', value: ['Manhattan, New York, United States'] },
  { name: 'instagram-gender-female', description: 'Gender declared as female.', keyPath: 'filters.gender', value: 'female' },
  { name: 'instagram-language-english', description: 'Profile language English.', keyPath: 'filters.profile_language', value: ['en'] },
  { name: 'instagram-follower-band', description: '10k-100k followers.', keyPath: 'filters.number_of_followers', value: { min: 10000, max: 100000 } },
  { name: 'instagram-high-followers', description: 'Over 250k followers.', keyPath: 'filters.number_of_followers', value: { min: 250000 } },
  { name: 'instagram-engagement-3-7', description: 'Engagement 3-7%.', keyPath: 'filters.engagement_percent', value: { min: 3, max: 7 } },
  { name: 'instagram-engagement-7plus', description: 'Engagement above 7%.', keyPath: 'filters.engagement_percent', value: { min: 7 } },
  { name: 'instagram-posting-frequency', description: 'Posting frequency >=4.', keyPath: 'filters.posting_frequency', value: 4 },
  { name: 'instagram-follower-growth-6m', description: 'Growth 10% over 6 months.', keyPath: 'filters.follower_growth', value: { growth_percentage: 10, time_range_months: 6 } },
  { name: 'instagram-average-likes', description: 'Average likes 500-5000.', keyPath: 'filters.average_likes', value: { min: 500, max: 5000 } },
  { name: 'instagram-average-comments', description: 'Average comments 30-200.', keyPath: 'filters.average_comments', value: { min: 30, max: 200 } },
  { name: 'instagram-average-views', description: 'Average views 3k-20k.', keyPath: 'filters.average_views', value: { min: 3000, max: 20000 } },
  { name: 'instagram-exclude-private', description: 'Exclude private accounts.', keyPath: 'filters.exclude_private_profile', value: true },
  { name: 'instagram-verified', description: 'Verified accounts only.', keyPath: 'filters.is_verified', value: true },
  { name: 'instagram-bio-holistic', description: 'Bio mentions holistic.', keyPath: 'filters.keywords_in_bio', value: ['holistic'] },
  { name: 'instagram-exclude-bio-weightloss', description: 'Exclude weight loss in bio.', keyPath: 'filters.exclude_keywords_in_bio', value: ['weight loss'] },
  { name: 'instagram-hashtags', description: '#mealprep hashtag presence.', keyPath: 'filters.hashtags', value: ['mealprep'] },
  { name: 'instagram-not-hashtags', description: 'Exclude #keto hashtag.', keyPath: 'filters.not_hashtags', value: ['keto'] },
  { name: 'instagram-link-in-bio', description: 'Link in bio contains Linktree.', keyPath: 'filters.link_in_bio', value: ['linktr.ee'] },
  { name: 'instagram-has-link-in-bio', description: 'Boolean has link in bio flag.', keyPath: 'filters.has_link_in_bio', value: true },
  { name: 'instagram-creator-has-linktree', description: 'Creator_has flag for Linktree.', keyPath: 'filters.creator_has.has_linktree', value: true },
  { name: 'instagram-creator-has-patreon', description: 'Creator_has flag for Patreon.', keyPath: 'filters.creator_has.has_patreon', value: true },
  { name: 'instagram-brand-deals', description: 'Has done brand deals.', keyPath: 'filters.has_done_brand_deals', value: true },
  { name: 'instagram-affiliate-links', description: 'Promotes affiliate links.', keyPath: 'filters.promotes_affiliate_links', value: true },
  { name: 'instagram-bio-keywords-not', description: 'Exclude detox keyword.', keyPath: 'filters.keywords_not_in_description', value: ['detox'] },
  { name: 'instagram-keywords-in-captions', description: 'Captions mention meal plan.', keyPath: 'filters.keywords_in_captions', value: ['meal plan'] },
  { name: 'instagram-reels-percent', description: 'Reels share >=50%.', keyPath: 'filters.reels_percent', value: { min: 50 } },
  { name: 'instagram-reels-views', description: 'Average reels views >=20k.', keyPath: 'filters.average_views_for_reels', value: { min: 20000 } },
  { name: 'instagram-number-of-posts', description: '300-1200 posts.', keyPath: 'filters.number_of_posts', value: { min: 300, max: 1200 } },
  { name: 'instagram-last-post-90', description: 'Posted within 90 days.', keyPath: 'filters.last_post', value: 90 },
  { name: 'instagram-last-post-365', description: 'Posted within 365 days.', keyPath: 'filters.last_post', value: 365 },
  { name: 'instagram-has-videos', description: 'Has videos flag.', keyPath: 'filters.has_videos', value: true },
  { name: 'instagram-has-podcast', description: 'Has podcast flag.', keyPath: 'filters.has_podcast', value: true },
  { name: 'instagram-has-courses', description: 'Has courses flag.', keyPath: 'filters.has_courses', value: true },
  { name: 'instagram-is-monetizing', description: 'Monetization flag.', keyPath: 'filters.is_monetizing', value: true },
  { name: 'instagram-keywords-in-description', description: 'General description keywords.', keyPath: 'filters.keywords_in_description', value: ['meal'] },
  { name: 'instagram-keywords-in-video-description', description: 'Video description keywords.', keyPath: 'filters.keywords_in_video_description', value: ['protein'] },
  { name: 'instagram-keywords-not-in-video-description', description: 'Exclude cleanse keyword in video description.', keyPath: 'filters.keywords_not_in_video_description', value: ['cleanse'] },
  { name: 'instagram-video-description-not', description: 'Exclude cleanse in video description.', keyPath: 'filters.not_video_description', value: ['cleanse'] },
  { name: 'instagram-video-description', description: 'Video description contains macros.', keyPath: 'filters.video_description', value: ['macros'] },
  { name: 'instagram-video-count', description: 'Video count 50-500.', keyPath: 'filters.video_count', value: { min: 50, max: 500 } },
];

const instagramSortAndPaging: ScenarioDefinition[] = [
  { name: 'instagram-sort-followers-desc', description: 'Sort by followers desc.', patch: { sort: { sort_by: 'number_of_followers', sort_order: 'desc' } } },
  { name: 'instagram-sort-engagement-asc', description: 'Sort by engagement asc.', patch: { sort: { sort_by: 'engagement_rate', sort_order: 'asc' } } },
  { name: 'instagram-paging-limit-20', description: 'Request 20 profiles.', patch: { paging: { limit: 20, page: 0 } } },
  { name: 'instagram-second-page', description: 'Second page of results.', patch: { paging: { limit: 10, page: 1 } } },
];

const tiktokDefs: ScenarioDefinition[] = [
  { name: 'tiktok-shop', description: 'TikTok Shop enabled creators.', platform: 'tiktok', keyPath: 'filters.has_tik_tok_shop', value: true },
  { name: 'tiktok-video-downloads', description: 'Average downloads >=100.', platform: 'tiktok', keyPath: 'filters.average_video_downloads', value: { min: 100 } },
  { name: 'tiktok-keywords-in-captions', description: 'Captions mention recipe.', platform: 'tiktok', keyPath: 'filters.keywords_in_captions', value: ['recipe'] },
  { name: 'tiktok-has-live-streams', description: 'Creators who livestream.', platform: 'tiktok', keyPath: 'filters.has_live_streams', value: true },
  { name: 'tiktok-does-live-streaming', description: 'Streaming flag true.', platform: 'tiktok', keyPath: 'filters.does_live_streaming', value: true },
  { name: 'tiktok-average-views', description: 'Average views >=50k.', platform: 'tiktok', keyPath: 'filters.average_views', value: { min: 50000 } },
  { name: 'tiktok-number-of-posts', description: 'Posts 200-1000.', platform: 'tiktok', keyPath: 'filters.number_of_posts', value: { min: 200, max: 1000 } },
  { name: 'tiktok-has-free-account', description: 'Free account flag.', platform: 'tiktok', keyPath: 'filters.has_free_account', value: true },
  { name: 'tiktok-has-videos', description: 'Has videos flag.', platform: 'tiktok', keyPath: 'filters.has_videos', value: true },
];

const youtubeDefs: ScenarioDefinition[] = [
  { name: 'youtube-subscriber-band', description: 'Subscribers 20k-250k.', platform: 'youtube', keyPath: 'filters.number_of_subscribers', value: { min: 20000, max: 250000 } },
  { name: 'youtube-has-shorts', description: 'Shorts enabled.', platform: 'youtube', keyPath: 'filters.has_shorts', value: true },
  { name: 'youtube-shorts-percentage', description: 'Shorts share >=40%.', platform: 'youtube', keyPath: 'filters.shorts_percentage', value: { min: 40 } },
  { name: 'youtube-long-video-views', description: 'Average long video views >=5k.', platform: 'youtube', keyPath: 'filters.average_views_on_long_videos', value: { min: 5000 } },
  { name: 'youtube-shorts-views', description: 'Average shorts views >=10k.', platform: 'youtube', keyPath: 'filters.average_views_on_shorts', value: { min: 10000 } },
  { name: 'youtube-number-of-videos', description: 'Video count >=100.', platform: 'youtube', keyPath: 'filters.number_of_videos', value: { min: 100 } },
  { name: 'youtube-community-posts', description: 'Has community posts.', platform: 'youtube', keyPath: 'filters.has_community_posts', value: true },
  { name: 'youtube-has-merch', description: 'Merchandise flag.', platform: 'youtube', keyPath: 'filters.has_merch', value: true },
  { name: 'youtube-is-monetizing', description: 'Channel monetization flag.', platform: 'youtube', keyPath: 'filters.is_monetizing', value: true },
  { name: 'youtube-video-title-keyword', description: 'Video titles mention meal prep.', platform: 'youtube', keyPath: 'filters.keywords_in_video_titles', value: ['meal prep'] },
  { name: 'youtube-description-keyword', description: 'Description mention macro.', platform: 'youtube', keyPath: 'filters.keywords_in_description', value: ['macro'] },
  { name: 'youtube-video-desc-keyword', description: 'Video description mention protein.', platform: 'youtube', keyPath: 'filters.keywords_in_video_description', value: ['protein'] },
  { name: 'youtube-topics-health', description: 'Topics includes Health.', platform: 'youtube', keyPath: 'filters.topics', value: ['Health'] },
  { name: 'youtube-links-in-description', description: 'Links contain bit.ly.', platform: 'youtube', keyPath: 'filters.links_from_description', value: ['bit.ly'] },
  { name: 'youtube-links-in-video-description', description: 'Video description links include shop.', platform: 'youtube', keyPath: 'filters.links_from_video_description', value: ['shop'] },
  { name: 'youtube-last-upload-long', description: 'Long video within 90 days.', platform: 'youtube', keyPath: 'filters.last_upload_long_video', value: 90 },
  { name: 'youtube-last-upload-short', description: 'Short video within 90 days.', platform: 'youtube', keyPath: 'filters.last_upload_short_video', value: 90 },
  { name: 'youtube-subscriber-growth', description: 'Subscriber growth 8% over 6 months.', platform: 'youtube', keyPath: 'filters.subscriber_growth', value: { growth_percentage: 8, time_range_months: 6 } },
  { name: 'youtube-has-videos', description: 'Has videos flag.', platform: 'youtube', keyPath: 'filters.has_videos', value: true },
];

const twitterDefs: ScenarioDefinition[] = [
  { name: 'twitter-tweet-volume', description: 'At least 200 tweets.', platform: 'twitter', keyPath: 'filters.number_of_tweets', value: { min: 200 } },
  { name: 'twitter-keywords-in-tweets', description: 'Tweets mention diet plan.', platform: 'twitter', keyPath: 'filters.keywords_in_tweets', value: ['diet plan'] },
  { name: 'twitter-last-post-90', description: 'Posted within 90 days.', platform: 'twitter', keyPath: 'filters.last_post', value: 90 },
  { name: 'twitter-has-brand-deals', description: 'Brand deals flag.', platform: 'twitter', keyPath: 'filters.has_done_brand_deals', value: true },
  { name: 'twitter-has-link-in-bio', description: 'Link in bio flag.', platform: 'twitter', keyPath: 'filters.has_link_in_bio', value: true },
];

const twitchDefs: ScenarioDefinition[] = [
  { name: 'twitch-stream-hours', description: '>=10 streamed hours last 30 days.', platform: 'twitch', keyPath: 'filters.streamed_hours_last_30_days', value: { min: 10 } },
  { name: 'twitch-total-hours', description: 'Total streamed hours >=200.', platform: 'twitch', keyPath: 'filters.total_hours_streamed', value: { min: 200 } },
  { name: 'twitch-max-views', description: 'Maximum views >=5000.', platform: 'twitch', keyPath: 'filters.maximum_views_count', value: { min: 5000 } },
  { name: 'twitch-average-views-last-30', description: 'Average views last 30 days >=1000.', platform: 'twitch', keyPath: 'filters.avg_views_last_30_days', value: { min: 1000 } },
  { name: 'twitch-stream-count', description: 'Streams count last 30 days >=4.', platform: 'twitch', keyPath: 'filters.streams_count_last_30_days', value: { min: 4 } },
  { name: 'twitch-games-played', description: 'Games include Just Chatting.', platform: 'twitch', keyPath: 'filters.games_played', value: ['Just Chatting'] },
  { name: 'twitch-partner', description: 'Twitch partner flag.', platform: 'twitch', keyPath: 'filters.is_twitch_partner', value: true },
  { name: 'twitch-income', description: 'Income estimate above $2000.', platform: 'twitch', keyPath: 'filters.income', value: { min: 2000 } },
  { name: 'twitch-most-recent-stream-60', description: 'Most recent stream within 60 days.', platform: 'twitch', keyPath: 'filters.most_recent_stream_date', value: 60 },
];

const onlyfansDefs: ScenarioDefinition[] = [
  { name: 'onlyfans-subscription-price', description: 'Subscription <=$15.', platform: 'onlyfans', keyPath: 'filters.subscription_price', value: { max: 15 } },
  { name: 'onlyfans-number-of-photos', description: 'Photos >=200.', platform: 'onlyfans', keyPath: 'filters.number_of_photos', value: { min: 200 } },
  { name: 'onlyfans-number-of-likes', description: 'Likes >=50k.', platform: 'onlyfans', keyPath: 'filters.number_of_likes', value: { min: 50000 } },
  { name: 'onlyfans-followers', description: 'Followers >=5000.', platform: 'onlyfans', keyPath: 'filters.followers', value: { min: 5000 } },
  { name: 'onlyfans-active-subscribers', description: 'Active subscribers >=100.', platform: 'onlyfans', keyPath: 'filters.active_subscribers', value: { min: 100 } },
  { name: 'onlyfans-has-brand-deals', description: 'Brand deals flag.', platform: 'onlyfans', keyPath: 'filters.has_done_brand_deals', value: true },
  { name: 'onlyfans-has-free-account', description: 'Free tier flag.', platform: 'onlyfans', keyPath: 'filters.has_free_account', value: true },
  { name: 'onlyfans-has-live-streams', description: 'Livestream capability flag.', platform: 'onlyfans', keyPath: 'filters.has_live_streams', value: true },
  { name: 'onlyfans-keywords-in-description', description: 'Description includes nutrition.', platform: 'onlyfans', keyPath: 'filters.video_description', value: ['nutrition'] },
];

const miscDefs: ScenarioDefinition[] = [
  { name: 'global-keyword-in-bio-not', description: 'Exclude detox across platforms.', keyPath: 'filters.exclude_keywords_in_bio', value: ['detox'] },
  { name: 'global-has-live-streaming', description: 'Generic live streaming flag.', keyPath: 'filters.does_live_streaming', value: true },
  { name: 'global-has-podcast', description: 'Generic podcast presence.', keyPath: 'filters.has_podcast', value: true },
  { name: 'global-brands-match', description: 'Brands array includes Nike.', keyPath: 'filters.brands', value: ['Nike'] },
  { name: 'global-creator-has-shopify', description: 'Creator has Shopify link flag.', keyPath: 'filters.creator_has.has_shopify', value: true },
];

const scenarioDefinitions = [
  ...platformBaselines,
  ...instagramFilterDefs,
  ...instagramSortAndPaging,
  ...tiktokDefs,
  ...youtubeDefs,
  ...twitterDefs,
  ...twitchDefs,
  ...onlyfansDefs,
  ...miscDefs,
];

const scenarios = scenarioDefinitions.map(scenarioFromDefinition);

function cloneRequest(request: DiscoveryRequest): DiscoveryRequest {
  return JSON.parse(JSON.stringify(request)) as DiscoveryRequest;
}

function scenarioFileName(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
}

function summarizeAccounts(accounts: DiscoveryAccount[], limit = 3) {
  return accounts.slice(0, limit).map((account) => ({
    user_id: account.user_id,
    username: account.profile?.username,
    followers: account.profile?.followers,
    engagement_percent: account.profile?.engagement_percent,
  }));
}

async function runScenario({ name, description, platform, patch }: Scenario, delayMs: number): Promise<void> {
  const payload = cloneRequest(baseRequest);
  if (platform) payload.platform = platform;
  deepMerge(payload as unknown as Record<string, unknown>, patch as Record<string, unknown>);

  const response = await fetch('https://api-dashboard.influencers.club/public/v1/discovery/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  const dir = path.join(outputRoot, scenarioFileName(name));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'request.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(dir, 'response.json'), JSON.stringify(body, null, 2));

  console.log(`\nScenario: ${name}`);
  console.log(`Description: ${description}`);
  console.log(`Status: ${response.status}`);

  if (body && Array.isArray((body as DiscoveryResponse).accounts)) {
    const typed = body as DiscoveryResponse;
    console.log(`Total: ${typed.total} | Limit: ${typed.limit} | Returned: ${typed.accounts.length}`);
    console.log('Sample accounts:', summarizeAccounts(typed.accounts));
  } else {
    console.log('Response snapshot:', body);
  }

  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function main() {
  const delayMs = Number(process.env.DISCOVERY_DELAY_MS ?? 500);
  console.log(`Running ${scenarios.length} discovery scenarios. Output -> ${outputRoot}`);
  for (const scenario of scenarios) {
    try {
      await runScenario(scenario, delayMs);
    } catch (error) {
      console.error(`Scenario ${scenario.name} failed`, error);
    }
  }
}

main().catch((error) => {
  console.error('Uncaught error in discovery scenario runner', error);
  process.exit(1);
});
