#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const jobId = process.argv[2] || '59c315dc-6358-4101-b8b7-9cbfcbe0e159';

const { data: results, error } = await supabase
  .from('scraping_results')
  .select('creators')
  .eq('job_id', jobId)
  .single();

if (error || !results?.creators) {
  console.error('No results found:', error?.message);
  process.exit(1);
}

const creators = results.creators;

// CSV Header
console.log('USERNAME,PLATFORM,FOLLOWERS,VIDEO_LIKES,VIDEO_COMMENTS,VIDEO_VIEWS,ENGAGEMENT_RATE,KEYWORD_MATCHED');

// Data rows
creators.forEach((c) => {
  const stats = c.video?.statistics || {};
  const likes = stats.likes || stats.likeCount || 0;
  const comments = stats.comments || stats.commentCount || 0;
  const views = stats.views || stats.viewCount || 0;
  const engagement = views > 0 ? ((likes + comments) / views * 100).toFixed(2) : '0.00';
  const keyword = c.video?.keyword || 'meditation wellness';

  console.log([
    c.username || c.handle || 'unknown',
    c.platform || 'instagram',
    c.followers || c.followerCount || 0,
    likes,
    comments,
    views,
    engagement + '%',
    keyword
  ].join(','));
});
