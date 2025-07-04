#!/usr/bin/env node

/**
 * Environment Setup Checker for Instagram API Testing
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

console.log('🔧 Instagram API Environment Setup Check');
console.log('=' . repeat(50));

const requiredVars = {
  'ScrapeCreators API': {
    'SCRAPECREATORS_INSTAGRAM_API_URL': process.env.SCRAPECREATORS_INSTAGRAM_API_URL,
    'SCRAPECREATORS_API_KEY': process.env.SCRAPECREATORS_API_KEY
  },
  'Apify': {
    'APIFY_TOKEN': process.env.APIFY_TOKEN,
    'INSTAGRAM_SCRAPER_ACTOR_ID': process.env.INSTAGRAM_SCRAPER_ACTOR_ID || 'dSCLg0C3YEZ83HzYX (default)'
  }
};

// Helper function
String.prototype.repeat = function(count) {
    return new Array(count + 1).join(this);
};

let allGood = true;

Object.entries(requiredVars).forEach(([provider, vars]) => {
  console.log(`\n📡 ${provider}:`);
  
  Object.entries(vars).forEach(([varName, value]) => {
    const status = value ? '✅' : '❌';
    const displayValue = value ? 
      (value.includes('default') ? value : `${value.substring(0, 10)}...`) : 
      'NOT SET';
    
    console.log(`   ${status} ${varName}: ${displayValue}`);
    
    if (!value && !varName.includes('INSTAGRAM_SCRAPER_ACTOR_ID')) {
      allGood = false;
    }
  });
});

console.log('\n' + '='.repeat(50));

if (allGood) {
  console.log('✅ Environment setup looks good!');
  console.log('\n🚀 You can now run:');
  console.log('   node scripts/quick-test-instagram-apis.js');
  console.log('   node scripts/research-instagram-similar-apis.js');
} else {
  console.log('❌ Some environment variables are missing.');
  console.log('\n🔧 Please check your .env.local file and add missing variables.');
  console.log('\n📋 Required format in .env.local:');
  console.log('SCRAPECREATORS_INSTAGRAM_API_URL=your_instagram_api_url');
  console.log('SCRAPECREATORS_API_KEY=your_api_key');
  console.log('APIFY_TOKEN=your_apify_token');
  console.log('INSTAGRAM_SCRAPER_ACTOR_ID=your_actor_id  # Optional');
} 