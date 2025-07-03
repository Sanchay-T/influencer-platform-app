#!/usr/bin/env node

/**
 * Test both hashtag scrapers to see which one works better
 */

const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const OUTPUT_DIR = path.join(__dirname, '../test-outputs');
const client = new ApifyClient({ token: APIFY_TOKEN });

// The two hashtag scrapers
const SCRAPERS = {
    search: {
        id: 'DrF9mzPPEuVizVF4l',
        name: 'Instagram Search Scraper',
        input: {
            search: "redbull",
            searchType: "hashtag",
            resultsType: "posts",
            resultsLimit: 15
        }
    },
    hashtag: {
        id: 'reGe1ST3OBgYZSsZJ', 
        name: 'Instagram Hashtag Scraper',
        input: {
            hashtags: ["redbull"],
            resultsLimit: 15
        }
    }
};

async function testScraper(scraperKey, scraper) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 Testing: ${scraper.name}`);
    console.log(`🆔 Actor ID: ${scraper.id}`);
    console.log('📥 Input:', JSON.stringify(scraper.input, null, 2));
    console.log('='.repeat(60));
    
    try {
        // Start the run
        const startTime = Date.now();
        const run = await client.actor(scraper.id).start(scraper.input);
        
        console.log(`⏳ Run started: ${run.id}`);
        console.log('⏱️  Waiting up to 60 seconds...');
        
        // Wait for completion
        const finishedRun = await client.run(run.id).waitForFinish({ waitSecs: 60 });
        
        const runTime = Date.now() - startTime;
        console.log(`\n✅ Run completed in ${Math.round(runTime / 1000)}s`);
        console.log(`   Status: ${finishedRun.status}`);
        console.log(`   Exit Code: ${finishedRun.exitCode}`);
        
        // Get results
        const { items } = await client.dataset(finishedRun.defaultDatasetId).listItems();
        
        console.log(`📊 Results: ${items.length} posts found`);
        
        if (items.length === 0) {
            console.log('⚠️  No posts retrieved');
            return { success: false, error: 'No results' };
        }
        
        // Analyze data structure
        const firstPost = items[0];
        console.log('\n🔍 Data Analysis:');
        console.log(`   Available fields: ${Object.keys(firstPost).length}`);
        console.log(`   Key fields: ${Object.keys(firstPost).slice(0, 8).join(', ')}...`);
        
        // Show sample posts
        console.log('\n📱 Sample Posts:');
        items.slice(0, 3).forEach((post, i) => {
            console.log(`\n   ${i + 1}. Post by @${post.ownerUsername || post.owner?.username || 'Unknown'}`);
            console.log(`      Type: ${post.type || 'Unknown'}`);
            console.log(`      Caption: ${(post.caption || post.text || '').substring(0, 80)}...`);
            console.log(`      Likes: ${post.likesCount || post.likes || 0}`);
            console.log(`      Comments: ${post.commentsCount || post.comments || 0}`);
            console.log(`      Hashtags: ${(post.hashtags || []).slice(0, 3).join(', ')}`);
            console.log(`      URL: ${post.url || post.shortcode ? `https://instagram.com/p/${post.shortcode}` : 'N/A'}`);
        });
        
        // Check data quality
        const quality = {
            postsWithCaptions: items.filter(p => p.caption).length,
            postsWithHashtags: items.filter(p => p.hashtags && p.hashtags.length > 0).length,
            postsWithOwners: items.filter(p => p.ownerUsername || p.owner?.username).length,
            postsWithLikes: items.filter(p => p.likesCount > 0 || p.likes > 0).length,
            postsWithUrls: items.filter(p => p.url || p.shortcode).length
        };
        
        console.log('\n📈 Data Quality:');
        console.log(`   Posts with captions: ${quality.postsWithCaptions}/${items.length}`);
        console.log(`   Posts with hashtags: ${quality.postsWithHashtags}/${items.length}`);
        console.log(`   Posts with owners: ${quality.postsWithOwners}/${items.length}`);
        console.log(`   Posts with likes: ${quality.postsWithLikes}/${items.length}`);
        console.log(`   Posts with URLs: ${quality.postsWithUrls}/${items.length}`);
        
        // Save results
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        const output = {
            metadata: {
                timestamp: new Date().toISOString(),
                scraper: scraper.name,
                actorId: scraper.id,
                runId: run.id,
                runTimeSeconds: Math.round(runTime / 1000),
                input: scraper.input,
                status: finishedRun.status,
                quality: quality
            },
            data: items,
            summary: {
                totalPosts: items.length,
                uniqueUsers: [...new Set(items.map(p => p.ownerUsername || p.owner?.username))].length,
                avgLikes: Math.round(items.reduce((sum, p) => sum + (p.likesCount || p.likes || 0), 0) / items.length),
                avgComments: Math.round(items.reduce((sum, p) => sum + (p.commentsCount || p.comments || 0), 0) / items.length)
            }
        };
        
        const filename = `apify-${scraperKey}-scraper-results.json`;
        await fs.writeFile(path.join(OUTPUT_DIR, filename), JSON.stringify(output, null, 2));
        console.log(`\n💾 Results saved to: ${filename}`);
        
        return { success: true, output, quality };
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Main execution
async function compareScrapers() {
    console.log('🏁 Instagram Hashtag Scrapers Comparison');
    console.log('Testing both scrapers with "redbull" search...\n');
    
    const results = {};
    
    // Test Instagram Search Scraper
    results.search = await testScraper('search', SCRAPERS.search);
    
    // Test Instagram Hashtag Scraper
    results.hashtag = await testScraper('hashtag', SCRAPERS.hashtag);
    
    // Comparison
    console.log(`\n${'='.repeat(60)}`);
    console.log('🏆 COMPARISON RESULTS');
    console.log('='.repeat(60));
    
    if (results.search.success && results.hashtag.success) {
        const searchResults = results.search.output.summary;
        const hashtagResults = results.hashtag.output.summary;
        
        console.log('\n📊 Results Count:');
        console.log(`   Search Scraper: ${searchResults.totalPosts} posts`);
        console.log(`   Hashtag Scraper: ${hashtagResults.totalPosts} posts`);
        
        console.log('\n👥 Unique Users:');
        console.log(`   Search Scraper: ${searchResults.uniqueUsers} users`);
        console.log(`   Hashtag Scraper: ${hashtagResults.uniqueUsers} users`);
        
        console.log('\n💖 Average Engagement:');
        console.log(`   Search Scraper: ${searchResults.avgLikes} likes, ${searchResults.avgComments} comments`);
        console.log(`   Hashtag Scraper: ${hashtagResults.avgLikes} likes, ${hashtagResults.avgComments} comments`);
        
        // Determine winner
        const searchScore = searchResults.totalPosts + searchResults.uniqueUsers;
        const hashtagScore = hashtagResults.totalPosts + hashtagResults.uniqueUsers;
        
        console.log('\n🎯 Recommendation:');
        if (searchScore > hashtagScore) {
            console.log(`   Use Instagram Search Scraper (${SCRAPERS.search.id})`);
            console.log('   Better overall results and data variety');
        } else if (hashtagScore > searchScore) {
            console.log(`   Use Instagram Hashtag Scraper (${SCRAPERS.hashtag.id})`);
            console.log('   Better for pure hashtag searches');
        } else {
            console.log('   Both scrapers performed similarly');
            console.log('   Instagram Search Scraper is more versatile (supports keywords + hashtags)');
        }
        
    } else if (results.search.success) {
        console.log('\n✅ Instagram Search Scraper works perfectly!');
        console.log(`   Use Actor ID: ${SCRAPERS.search.id}`);
        
    } else if (results.hashtag.success) {
        console.log('\n✅ Instagram Hashtag Scraper works perfectly!');
        console.log(`   Use Actor ID: ${SCRAPERS.hashtag.id}`);
        
    } else {
        console.log('\n❌ Both scrapers had issues');
        console.log('Check error messages above');
    }
    
    console.log('\n📝 Integration Notes:');
    console.log('1. Add the working actor ID to your .env.local');
    console.log('2. Update your Instagram scraping endpoint to use Apify');
    console.log('3. Map the response fields to your existing data model');
    console.log('4. The scrapers return real Instagram posts with hashtag #redbull');
    
    console.log('\n🔗 Files created:');
    console.log('   - apify-search-scraper-results.json');
    console.log('   - apify-hashtag-scraper-results.json');
    console.log('='.repeat(60));
}

// Run the comparison
compareScrapers().catch(console.error);