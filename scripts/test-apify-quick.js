#!/usr/bin/env node

/**
 * Quick test to identify which actor is the hashtag scraper
 */

const { ApifyClient } = require('apify-client');
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

// Actor IDs to test
const ACTORS = {
    'DrF9mzPPEuVizVF4l': 'Actor 1',
    'reGe1ST3OBgYZSsZJ': 'Actor 2'
};

async function checkActor(actorId, label) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎭 Checking ${label}: ${actorId}`);
    console.log('='.repeat(60));
    
    try {
        const actor = await client.actor(actorId).get();
        
        console.log(`✅ Actor Details:`);
        console.log(`   Name: ${actor.name}`);
        console.log(`   Title: ${actor.title}`);
        console.log(`   Username: ${actor.username}`);
        console.log(`   Description: ${(actor.description || '').substring(0, 200)}...`);
        
        // Check if it's likely a hashtag scraper based on name/title
        const isHashtagScraper = 
            actor.name?.toLowerCase().includes('hashtag') ||
            actor.title?.toLowerCase().includes('hashtag') ||
            actor.name?.toLowerCase().includes('search') ||
            actor.description?.toLowerCase().includes('hashtag');
            
        if (isHashtagScraper) {
            console.log(`\n✨ LIKELY A HASHTAG/SEARCH SCRAPER!`);
        }
        
        // Try to get the README or example input
        try {
            const lastVersion = await client.actor(actorId).lastRun().get();
            if (lastVersion?.input) {
                console.log('\n📋 Example input from last run:');
                console.log(JSON.stringify(lastVersion.input, null, 2).substring(0, 300) + '...');
            }
        } catch (e) {
            // Ignore
        }
        
        return { actorId, actor, isHashtagScraper };
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return null;
    }
}

// Run quick checks
(async () => {
    console.log('🚀 Quick Apify Actor Check');
    console.log(`🔑 Token: ${APIFY_TOKEN.substring(0, 10)}...`);
    
    const results = [];
    
    for (const [actorId, label] of Object.entries(ACTORS)) {
        const result = await checkActor(actorId, label);
        if (result) results.push(result);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const hashtagScrapers = results.filter(r => r.isHashtagScraper);
    
    if (hashtagScrapers.length > 0) {
        console.log('\n✅ Hashtag/Search Scrapers Found:');
        hashtagScrapers.forEach(scraper => {
            console.log(`\n🎯 Actor ID: ${scraper.actorId}`);
            console.log(`   Name: ${scraper.actor.name}`);
            console.log(`   Title: ${scraper.actor.title}`);
            
            // Suggest input format based on name
            if (scraper.actor.name === 'instagram-search-scraper') {
                console.log('\n   📝 Suggested input format:');
                console.log('   {');
                console.log('     "search": "redbull",');
                console.log('     "searchType": "hashtag",');
                console.log('     "resultsType": "posts",');
                console.log('     "resultsLimit": 20');
                console.log('   }');
            } else if (scraper.actor.name.includes('hashtag')) {
                console.log('\n   📝 Suggested input format:');
                console.log('   {');
                console.log('     "hashtags": ["redbull"],');
                console.log('     "resultsLimit": 20');
                console.log('   }');
            }
        });
    }
    
    // Let's do a quick test with the first hashtag scraper
    if (hashtagScrapers.length > 0) {
        const testActor = hashtagScrapers[0];
        console.log(`\n\n🧪 Quick test with ${testActor.actor.name}...`);
        
        const testInput = testActor.actor.name === 'instagram-search-scraper' 
            ? {
                search: "redbull",
                searchType: "hashtag",
                resultsType: "posts",
                resultsLimit: 10
              }
            : {
                hashtags: ["redbull"],
                resultsLimit: 10
              };
              
        console.log('Test input:', JSON.stringify(testInput, null, 2));
        
        try {
            const run = await client.actor(testActor.actorId).start(testInput);
            console.log(`\n✅ Test run started successfully!`);
            console.log(`   Run ID: ${run.id}`);
            console.log(`   Status: ${run.status}`);
            console.log(`\n💡 The run is processing in the background.`);
            console.log(`   You can check results at: https://console.apify.com/view/runs/${run.id}`);
            
            // Store the correct actor ID
            console.log(`\n📌 CONFIRMED HASHTAG SCRAPER:`);
            console.log(`   Actor ID: ${testActor.actorId}`);
            console.log(`   Add to .env.local: INSTAGRAM_HASHTAG_SCRAPER_ID="${testActor.actorId}"`);
            
        } catch (error) {
            console.log(`\n❌ Test failed: ${error.message}`);
        }
    }
    
})().catch(console.error);