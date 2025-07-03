#!/usr/bin/env node

/**
 * Test script using Apify Client SDK
 * Tests Instagram scraping with proper actor discovery
 */

const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const INSTAGRAM_SCRAPER_ACTOR_ID = process.env.INSTAGRAM_SCRAPER_ACTOR_ID;
const OUTPUT_DIR = path.join(__dirname, '../test-outputs');

// Initialize the ApifyClient
const client = new ApifyClient({
    token: APIFY_TOKEN,
});

// Test configurations
const TEST_CONFIGS = {
    // Test 1: Profile scraper (based on error message expecting usernames)
    profileScraper: {
        actorId: INSTAGRAM_SCRAPER_ACTOR_ID,
        input: {
            usernames: ['redbull'],
            resultsLimit: 10
        },
        outputFile: 'apify-instagram-profile-test.json'
    },
    
    // Test 2: Try standard search scraper format
    searchScraper: {
        actorId: INSTAGRAM_SCRAPER_ACTOR_ID,
        input: {
            search: 'redbull',
            searchType: 'hashtag',
            searchLimit: 2,
            resultsType: 'posts',
            resultsLimit: 10
        },
        outputFile: 'apify-instagram-search-test.json'
    },
    
    // Test 3: Minimal test
    minimalTest: {
        actorId: INSTAGRAM_SCRAPER_ACTOR_ID,
        input: {
            directUrls: ['https://www.instagram.com/redbull/'],
            resultsLimit: 5
        },
        outputFile: 'apify-instagram-minimal-test.json'
    }
};

async function getActorInfo() {
    console.log('\n📋 Getting Actor Information...');
    try {
        const actor = await client.actor(INSTAGRAM_SCRAPER_ACTOR_ID).get();
        console.log('✅ Actor found:');
        console.log(`   Name: ${actor.name || 'N/A'}`);
        console.log(`   Title: ${actor.title || 'N/A'}`);
        console.log(`   Description: ${(actor.description || 'N/A').substring(0, 100)}...`);
        console.log(`   Latest version: ${actor.versions?.items?.[0]?.versionNumber || 'N/A'}`);
        
        // Try to get input schema
        if (actor.versions?.items?.[0]?.sourceFiles?.find(f => f.name === 'INPUT_SCHEMA.json')) {
            console.log('   ✅ Has INPUT_SCHEMA.json');
        }
        
        return actor;
    } catch (error) {
        console.log('❌ Could not get actor info:', error.message);
        return null;
    }
}

async function testApifyActor(testName, config) {
    console.log(`\n🚀 Running test: ${testName}`);
    console.log('📥 Input:', JSON.stringify(config.input, null, 2));
    
    try {
        // Create output directory
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        
        const startTime = Date.now();
        console.log('⏳ Starting actor run...');
        
        // Run the actor
        const run = await client.actor(config.actorId).call(config.input, {
            waitForFinish: true,
            timeout: 60 // 60 seconds timeout
        });
        
        const runTime = Date.now() - startTime;
        console.log(`✅ Run finished in ${runTime}ms`);
        console.log(`   Status: ${run.status}`);
        console.log(`   Run ID: ${run.id}`);
        
        // Get the results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        console.log(`📊 Results: ${items.length} items`);
        
        // Create output object
        const output = {
            metadata: {
                timestamp: new Date().toISOString(),
                testName: testName,
                actorId: config.actorId,
                runId: run.id,
                status: run.status,
                runTime: runTime,
                itemCount: items.length,
                input: config.input
            },
            data: items,
            summary: null
        };
        
        // Add summary based on data
        if (items.length > 0) {
            const firstItem = items[0];
            console.log('\n📄 First item structure:');
            console.log('   Fields:', Object.keys(firstItem).join(', '));
            
            // Check what type of data we got
            if (firstItem.username || firstItem.ownerUsername) {
                // Profile or post data
                output.summary = {
                    type: firstItem.ownerUsername ? 'posts' : 'profiles',
                    sampleData: items.slice(0, 3).map(item => ({
                        username: item.username || item.ownerUsername,
                        fullName: item.fullName || item.ownerFullName,
                        id: item.id || item.ownerId,
                        ...(item.likesCount !== undefined && {
                            likes: item.likesCount,
                            comments: item.commentsCount
                        })
                    }))
                };
                
                console.log('\n👀 Sample data:');
                output.summary.sampleData.forEach((item, i) => {
                    console.log(`   ${i + 1}. @${item.username} (${item.fullName || 'N/A'})`);
                    if (item.likes !== undefined) {
                        console.log(`      Engagement: ${item.likes} likes, ${item.comments} comments`);
                    }
                });
            }
        }
        
        // Save output
        const outputPath = path.join(OUTPUT_DIR, config.outputFile);
        await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
        console.log(`\n💾 Results saved to: ${outputPath}`);
        
        return { success: true, output };
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        
        // Save error details
        const errorOutput = {
            metadata: {
                timestamp: new Date().toISOString(),
                testName: testName,
                actorId: config.actorId,
                input: config.input
            },
            error: {
                message: error.message,
                type: error.constructor.name,
                details: error.clientError || error.cause || null
            }
        };
        
        const errorPath = path.join(OUTPUT_DIR, `error-${config.outputFile}`);
        await fs.writeFile(errorPath, JSON.stringify(errorOutput, null, 2));
        
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('=' . repeat(60));
    console.log('🧪 Apify Instagram Scraper Tests');
    console.log('=' . repeat(60));
    console.log(`🔑 Token: ${APIFY_TOKEN.substring(0, 10)}...`);
    console.log(`🎭 Actor ID: ${INSTAGRAM_SCRAPER_ACTOR_ID}`);
    
    // Get actor information first
    await getActorInfo();
    
    // Run tests
    const results = [];
    
    // Test 1: Profile scraper format
    console.log('\n' + '-'.repeat(60));
    const result1 = await testApifyActor('Profile Scraper Format', TEST_CONFIGS.profileScraper);
    results.push(result1);
    
    // Only run other tests if first one fails
    if (!result1.success) {
        console.log('\n' + '-'.repeat(60));
        const result2 = await testApifyActor('Search Scraper Format', TEST_CONFIGS.searchScraper);
        results.push(result2);
        
        if (!result2.success) {
            console.log('\n' + '-'.repeat(60));
            const result3 = await testApifyActor('Minimal Test', TEST_CONFIGS.minimalTest);
            results.push(result3);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary:');
    const successfulTest = results.find(r => r.success);
    
    if (successfulTest) {
        console.log('✅ Successful test found!');
        console.log('   Working input format:', successfulTest.output.metadata.input);
        console.log('\n📝 Next steps:');
        console.log('1. Review the successful output file');
        console.log('2. Map the data structure to your existing model');
        console.log('3. Implement the integration');
    } else {
        console.log('❌ All tests failed');
        console.log('\n🔍 Debugging suggestions:');
        console.log('1. Check if the actor ID is correct');
        console.log('2. Verify the Apify token has access to this actor');
        console.log('3. Check error files in test-outputs directory');
        console.log('4. Try using Apify console to test the actor manually');
    }
    
    console.log('=' . repeat(60));
}

// Helper function to simulate string repeat
String.prototype.repeat = function(count) {
    return new Array(count + 1).join(this);
};

// Run tests
runAllTests().catch(console.error);