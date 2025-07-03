#!/usr/bin/env node

/**
 * Final test script for Apify Instagram Profile Scraper
 * Using correct SDK methods
 */

const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const INSTAGRAM_SCRAPER_ACTOR_ID = process.env.INSTAGRAM_SCRAPER_ACTOR_ID;
const OUTPUT_DIR = path.join(__dirname, '../test-outputs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'apify-instagram-final-response.json');

// Initialize the ApifyClient
const client = new ApifyClient({
    token: APIFY_TOKEN,
});

// Test input - based on actor info, this is a profile scraper
const TEST_INPUT = {
    usernames: ['redbull', 'redbullracing', 'redbullmusic'],
    resultsLimit: 20,  // Get last 20 posts from each profile
    addParentData: true  // Include profile data with posts
};

async function testInstagramProfileScraper() {
    console.log('🚀 Starting Instagram Profile Scraper Test');
    console.log('🎭 Actor: Instagram Profile Scraper');
    console.log('📥 Input:', JSON.stringify(TEST_INPUT, null, 2));
    console.log('');
    
    try {
        // Create output directory
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        
        const startTime = Date.now();
        console.log('⏳ Starting actor run...');
        
        // Start the actor run
        const run = await client.actor(INSTAGRAM_SCRAPER_ACTOR_ID).start(TEST_INPUT);
        
        console.log(`🏃 Run started with ID: ${run.id}`);
        console.log('⏳ Waiting for run to finish...');
        
        // Wait for the run to finish
        await client.run(run.id).waitForFinish();
        
        // Get run details
        const runDetails = await client.run(run.id).get();
        const runTime = Date.now() - startTime;
        
        console.log(`✅ Run finished in ${Math.round(runTime / 1000)}s`);
        console.log(`   Status: ${runDetails.status}`);
        console.log(`   Exit code: ${runDetails.exitCode}`);
        
        // Get the results from the default dataset
        let items = [];
        let offset = 0;
        const limit = 100;
        
        // Paginate through results
        while (true) {
            const result = await client.dataset(runDetails.defaultDatasetId).listItems({
                offset,
                limit
            });
            
            items = items.concat(result.items);
            
            if (result.items.length < limit) break;
            offset += limit;
        }
        
        console.log(`\n📊 Results: ${items.length} items retrieved`);
        
        // Create output object
        const output = {
            metadata: {
                timestamp: new Date().toISOString(),
                actorId: INSTAGRAM_SCRAPER_ACTOR_ID,
                runId: run.id,
                status: runDetails.status,
                exitCode: runDetails.exitCode,
                runTimeSeconds: Math.round(runTime / 1000),
                itemCount: items.length,
                input: TEST_INPUT
            },
            data: items,
            summary: null,
            dataStructure: null
        };
        
        // Analyze results
        if (items.length > 0) {
            const firstItem = items[0];
            
            // Document data structure
            output.dataStructure = {
                availableFields: Object.keys(firstItem),
                fieldTypes: Object.entries(firstItem).reduce((acc, [key, value]) => {
                    acc[key] = Array.isArray(value) ? 'array' : typeof value;
                    return acc;
                }, {}),
                sampleItem: firstItem
            };
            
            // Create summary based on data type
            if (firstItem.username) {
                // Profile data
                output.summary = {
                    type: 'profiles',
                    profiles: items.filter(item => item.username).map(profile => ({
                        username: profile.username,
                        fullName: profile.fullName,
                        biography: profile.biography,
                        followersCount: profile.followersCount,
                        followingCount: profile.followingCount,
                        postsCount: profile.postsCount,
                        isVerified: profile.verified,
                        isPrivate: profile.private,
                        profilePicUrl: profile.profilePicUrl,
                        externalUrl: profile.externalUrl,
                        businessEmail: profile.businessEmail || profile.publicEmail
                    })),
                    posts: []
                };
            }
            
            // Check for posts data
            const posts = items.filter(item => item.ownerUsername || item.shortCode);
            if (posts.length > 0) {
                output.summary.posts = posts.slice(0, 10).map(post => ({
                    ownerUsername: post.ownerUsername || post.username,
                    type: post.type,
                    caption: post.caption ? post.caption.substring(0, 100) + '...' : '',
                    likesCount: post.likesCount,
                    commentsCount: post.commentsCount,
                    url: post.url,
                    displayUrl: post.displayUrl,
                    timestamp: post.timestamp,
                    hashtags: post.hashtags || []
                }));
            }
            
            // Print summary
            console.log('\n📋 Data Summary:');
            if (output.summary.profiles.length > 0) {
                console.log(`\n👥 Profiles (${output.summary.profiles.length}):`);
                output.summary.profiles.forEach((profile, i) => {
                    console.log(`   ${i + 1}. @${profile.username} - ${profile.fullName}`);
                    console.log(`      Followers: ${profile.followersCount?.toLocaleString() || 'N/A'}`);
                    console.log(`      Bio: ${(profile.biography || '').substring(0, 60)}...`);
                    if (profile.businessEmail) {
                        console.log(`      📧 Email: ${profile.businessEmail}`);
                    }
                });
            }
            
            if (output.summary.posts.length > 0) {
                console.log(`\n📱 Sample Posts (${posts.length} total):`);
                output.summary.posts.slice(0, 3).forEach((post, i) => {
                    console.log(`   ${i + 1}. @${post.ownerUsername} - ${post.type}`);
                    console.log(`      Caption: ${post.caption}`);
                    console.log(`      Engagement: ${post.likesCount} likes, ${post.commentsCount} comments`);
                    console.log(`      Posted: ${new Date(post.timestamp).toLocaleString()}`);
                });
            }
            
            console.log('\n🔧 Available fields:', output.dataStructure.availableFields.join(', '));
        }
        
        // Save output
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
        console.log(`\n💾 Full response saved to: ${OUTPUT_FILE}`);
        
        // Integration mapping
        console.log('\n📝 Integration Mapping to Existing Platform:');
        console.log('1. Profile Data Mapping:');
        console.log('   - username → creator.uniqueId');
        console.log('   - fullName → creator.name');
        console.log('   - followersCount → creator.followers');
        console.log('   - profilePicUrl → creator.avatarUrl');
        console.log('   - biography → creator.bio');
        console.log('   - businessEmail → creator.emails[0]');
        console.log('\n2. Post Data Mapping:');
        console.log('   - ownerUsername → creator.uniqueId');
        console.log('   - caption → video.description');
        console.log('   - likesCount → video.statistics.likes');
        console.log('   - commentsCount → video.statistics.comments');
        console.log('   - url → video.url');
        console.log('   - hashtags → hashtags');
        
        return output;
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        // Check specific error types
        if (error.message.includes('token')) {
            console.error('🔑 Authentication error - check your APIFY_TOKEN');
        } else if (error.message.includes('not found')) {
            console.error('🎭 Actor not found - check INSTAGRAM_SCRAPER_ACTOR_ID');
        }
        
        // Save error details
        const errorOutput = {
            metadata: {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack,
                type: error.constructor.name
            }
        };
        
        await fs.writeFile(
            path.join(OUTPUT_DIR, 'apify-instagram-final-error.json'),
            JSON.stringify(errorOutput, null, 2)
        );
        
        throw error;
    }
}

// Run the test
console.log('=' . repeat(60));
console.log('🧪 Apify Instagram Profile Scraper Test');
console.log('=' . repeat(60));

// Helper function
String.prototype.repeat = function(count) {
    return new Array(count + 1).join(this);
};

testInstagramProfileScraper().then(() => {
    console.log('\n✨ Test complete!');
    console.log('\n🚀 Next Steps:');
    console.log('1. Review the output file for complete data structure');
    console.log('2. Note that this actor provides PROFILE data, not hashtag search');
    console.log('3. For hashtag/keyword search, you may need a different Apify actor');
    console.log('4. Consider using this for "similar profiles" functionality');
    console.log('=' . repeat(60));
}).catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
});