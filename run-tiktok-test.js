#!/usr/bin/env node

/**
 * Simple runner for TikTok Similar Search Test
 */

require('dotenv').config({ path: '.env.local' });
const { runTikTokSimilarSearchTest } = require('./tests/tiktok-similar-search-test');

console.log('🔧 Checking environment...');

if (!process.env.SCRAPECREATORS_API_KEY) {
  console.error('❌ Missing SCRAPECREATORS_API_KEY environment variable');
  console.log('💡 Add your API key to .env file:');
  console.log('   SCRAPECREATORS_API_KEY=your_api_key_here');
  process.exit(1);
}

console.log('✅ Environment ready');
console.log('🚀 Starting TikTok Similar Search Test...\n');

runTikTokSimilarSearchTest();