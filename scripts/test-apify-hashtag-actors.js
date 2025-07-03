#!/usr/bin/env node

/**
 * Test script to check both potential hashtag scraper actor IDs
 */

const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const OUTPUT_DIR = path.join(__dirname, '../test-outputs');

// Actor IDs to test
const ACTOR_IDS = {
    actor1: 'DrF9mzPPEuVizVF4l',
    actor2: 'reGe1ST3OBgYZSsZJ'
};

// Initialize the ApifyClient
const client = new ApifyClient({
    token: APIFY_TOKEN,
});

// Test configurations for hashtag search
const HASHTAG_TEST_CONFIGS = [
    {
        // Config 1: Standard hashtag search format
        hashtags: ['redbull'],
        resultsLimit: 10
    },
    {
        // Config 2: Alternative format
        hashtag: 'redbull',
        limit: 10
    },
    {
        // Config 3: Search format
        search: 'redbull',
        searchType: 'hashtag',
        resultsLimit: 10
    },
    {
        // Config 4: Direct hashtag format
        directUrls: ['https://www.instagram.com/explore/tags/redbull/'],
        resultsLimit: 10
    }
];

async function getActorInfo(actorId) {
    console.log(`\n📋 Getting info for Actor: ${actorId}`);
    try {
        const actor = await client.actor(actorId).get();
        console.log('✅ Actor found:');
        console.log(`   Name: ${actor.name || 'N/A'}`);
        console.log(`   Title: ${actor.title || 'N/A'}`);
        console.log(`   Description: ${(actor.description || 'N/A').substring(0, 150)}...`);
        console.log(`   Username: ${actor.username || 'N/A'}`);
        
        return actor;
    } catch (error) {
        console.log('❌ Could not get actor info:', error.message);
        return null;
    }
}

async function testActorWithConfig(actorId, config, configName) {
    console.log(`\n🧪 Testing with ${configName}:`);
    console.log('Input:', JSON.stringify(config, null, 2));
    
    try {
        const startTime = Date.now();
        
        // Start the actor run
        const run = await client.actor(actorId).start(config);
        console.log(`⏳ Run started: ${run.id}`);
        
        // Wait for completion (max 30 seconds)
        const finishedRun = await client.run(run.id).waitForFinish({ waitSecs: 30 });
        
        const runTime = Date.now() - startTime;
        console.log(`✅ Finished in ${Math.round(runTime / 1000)}s`);
        console.log(`   Status: ${finishedRun.status}`);
        
        // Get results
        const { items } = await client.dataset(finishedRun.defaultDatasetId).listItems({ limit: 5 });
        
        if (items.length > 0) {
            console.log(`📊 Got ${items.length} results!`);
            console.log('🔧 First item structure:');
            console.log('   Fields:', Object.keys(items[0]).slice(0, 10).join(', '), '...');
            
            // Check if it's hashtag data
            const firstItem = items[0];
            if (firstItem.caption || firstItem.hashtags || firstItem.text) {
                console.log('✨ Looks like post/hashtag data!');
                console.log(`   Sample: ${(firstItem.caption || firstItem.text || '').substring(0, 100)}...`);
            }
            
            return { success: true, items, config };
        } else {
            console.log('⚠️  No results returned');
            return { success: false, error: 'No results' };
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testActor(actorId, actorName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎭 Testing Actor: ${actorName} (${actorId})`);
    console.log('='.repeat(60));
    
    // Get actor info
    const actorInfo = await getActorInfo(actorId);
    
    if (!actorInfo) {
        console.log('⚠️  Skipping tests - actor not accessible');
        return null;
    }
    
    // Test each configuration
    for (let i = 0; i < HASHTAG_TEST_CONFIGS.length; i++) {
        const config = HASHTAG_TEST_CONFIGS[i];
        const result = await testActorWithConfig(actorId, config, `Config ${i + 1}`);
        
        if (result.success) {
            // Save successful result
            const output = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    actorId: actorId,
                    actorName: actorInfo.name,
                    actorTitle: actorInfo.title,
                    successfulConfig: result.config,
                    configIndex: i
                },
                sampleData: result.items,
                analysis: {
                    totalItems: result.items.length,
                    fields: Object.keys(result.items[0] || {}),
                    dataType: determineDataType(result.items[0])
                }
            };
            
            const filename = `apify-hashtag-${actorName}-success.json`;
            await fs.mkdir(OUTPUT_DIR, { recursive: true });
            await fs.writeFile(
                path.join(OUTPUT_DIR, filename),
                JSON.stringify(output, null, 2)
            );
            
            console.log(`\n✅ SUCCESS! This actor works for hashtag search`);
            console.log(`💾 Results saved to: ${filename}`);
            
            // Show sample data
            if (result.items[0]) {
                console.log('\n📱 Sample post data:');
                const post = result.items[0];
                console.log(`   Type: ${post.type || 'Unknown'}`);
                console.log(`   Caption: ${(post.caption || post.text || '').substring(0, 80)}...`);
                console.log(`   Owner: @${post.ownerUsername || post.owner?.username || 'Unknown'}`);
                console.log(`   Likes: ${post.likesCount || post.likes || 0}`);
                console.log(`   Hashtags: ${(post.hashtags || []).slice(0, 5).join(', ')}`);
            }
            
            return output;
        }
    }
    
    console.log('\n❌ None of the configurations worked for this actor');
    return null;
}

function determineDataType(item) {
    if (!item) return 'unknown';
    
    if (item.caption && (item.ownerUsername || item.owner)) {
        return 'instagram_post';
    } else if (item.text && item.hashtags) {
        return 'hashtag_post';
    } else if (item.username && item.followersCount) {
        return 'profile';
    } else {
        return 'other';
    }
}

// Main execution
async function runTests() {
    console.log('🚀 Apify Hashtag Scraper Discovery');
    console.log(`🔑 Using token: ${APIFY_TOKEN.substring(0, 10)}...`);
    
    const results = {};
    
    // Test Actor 1
    results.actor1 = await testActor(ACTOR_IDS.actor1, 'actor1');
    
    // Test Actor 2  
    results.actor2 = await testActor(ACTOR_IDS.actor2, 'actor2');
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const workingActors = [];
    
    if (results.actor1?.metadata) {
        workingActors.push({
            id: ACTOR_IDS.actor1,
            name: results.actor1.metadata.actorName,
            config: results.actor1.metadata.successfulConfig
        });
    }
    
    if (results.actor2?.metadata) {
        workingActors.push({
            id: ACTOR_IDS.actor2,
            name: results.actor2.metadata.actorName,
            config: results.actor2.metadata.successfulConfig
        });
    }
    
    if (workingActors.length > 0) {
        console.log('\n✅ Working Hashtag Scrapers Found:');
        workingActors.forEach((actor, i) => {
            console.log(`\n${i + 1}. Actor: ${actor.id}`);
            console.log(`   Name: ${actor.name}`);
            console.log(`   Working config:`, JSON.stringify(actor.config));
        });
        
        console.log('\n🎯 Recommended actor for hashtag search:');
        console.log(`   ID: ${workingActors[0].id}`);
        console.log(`   Use this config:`, JSON.stringify(workingActors[0].config, null, 2));
    } else {
        console.log('\n❌ No working hashtag scrapers found');
        console.log('These actor IDs might not be hashtag scrapers or require different input formats');
    }
    
    console.log('\n📁 Check test-outputs/ directory for detailed results');
    console.log('='.repeat(60));
}

// Run the tests
runTests().catch(console.error);