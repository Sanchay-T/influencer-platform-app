/**
 * Test Apify YouTube Scrapers to see what similar channel data we can get
 */

const { ApifyClient } = require('apify-client');

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: process.env.APIFY_TOKEN
});

async function testApifyYouTubeScrapers() {
    console.log('🧪 [APIFY-TEST] Testing Apify YouTube Scrapers for Similar Channel Data');
    console.log('=' .repeat(80));
    
    const testChannels = [
        { username: 'mkbhd', name: 'MKBHD', niche: 'tech' },
        { username: 'fitnessblender', name: 'FitnessBlender', niche: 'fitness' },
        { username: 'bingingwithbabish', name: 'Binging with Babish', niche: 'cooking' }
    ];
    
    const results = [];
    
    for (const channel of testChannels) {
        console.log(`\n🔍 [TEST] Testing channel: ${channel.name} (@${channel.username})`);
        
        try {
            // Test 1: Apify's Main YouTube Scraper
            console.log('\n--- Test 1: Main YouTube Scraper ---');
            const mainScraperResult = await testMainYouTubeScraper(channel);
            
            // Test 2: Fast YouTube Channel Scraper  
            console.log('\n--- Test 2: Fast YouTube Channel Scraper ---');
            const fastScraperResult = await testFastChannelScraper(channel);
            
            // Test 3: Best YouTube Channels Scraper
            console.log('\n--- Test 3: Best YouTube Channels Scraper ---');
            const bestScraperResult = await testBestChannelsScraper(channel);
            
            results.push({
                channel,
                mainScraper: mainScraperResult,
                fastScraper: fastScraperResult,
                bestScraper: bestScraperResult
            });
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ [ERROR] Failed to test ${channel.name}:`, error.message);
            results.push({
                channel,
                error: error.message
            });
        }
    }
    
    // Generate comprehensive report
    generateApifyTestReport(results);
    return results;
}

/**
 * Test Apify's main YouTube scraper
 */
async function testMainYouTubeScraper(channel) {
    console.log(`🔍 Testing main YouTube scraper for @${channel.username}`);
    
    try {
        const input = {
            searchKeywords: [channel.name],
            maxResults: 5,
            includeVideoDetails: true,
            includeChannelDetails: true
        };
        
        console.log('📤 Input:', JSON.stringify(input, null, 2));
        
        // Run the main YouTube scraper
        const run = await client.actor('streamers/youtube-scraper').call(input);
        
        // Fetch and return results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        console.log(`✅ Main scraper results: ${items.length} items`);
        if (items.length > 0) {
            console.log('📊 Sample result structure:', Object.keys(items[0]));
            console.log('📄 First result:', JSON.stringify(items[0], null, 2));
        }
        
        return {
            success: true,
            itemCount: items.length,
            sampleData: items[0] || null,
            fullData: items
        };
        
    } catch (error) {
        console.error('❌ Main scraper error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test Apify's fast YouTube channel scraper
 */
async function testFastChannelScraper(channel) {
    console.log(`🔍 Testing fast channel scraper for @${channel.username}`);
    
    try {
        const input = {
            channelUrls: [`https://www.youtube.com/@${channel.username}`],
            includeChannelInfo: true,
            includeVideos: true,
            maxVideos: 5
        };
        
        console.log('📤 Input:', JSON.stringify(input, null, 2));
        
        // Run the fast channel scraper
        const run = await client.actor('streamers/youtube-channel-scraper').call(input);
        
        // Fetch and return results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        console.log(`✅ Fast scraper results: ${items.length} items`);
        if (items.length > 0) {
            console.log('📊 Sample result structure:', Object.keys(items[0]));
            console.log('📄 First result:', JSON.stringify(items[0], null, 2));
        }
        
        return {
            success: true,
            itemCount: items.length,
            sampleData: items[0] || null,
            fullData: items
        };
        
    } catch (error) {
        console.error('❌ Fast scraper error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test Apify's best YouTube channels scraper
 */
async function testBestChannelsScraper(channel) {
    console.log(`🔍 Testing best channels scraper for @${channel.username}`);
    
    try {
        const input = {
            channelUrl: `https://www.youtube.com/@${channel.username}`,
            includeRelatedChannels: true,
            includeFeaturedChannels: true,
            maxResults: 10
        };
        
        console.log('📤 Input:', JSON.stringify(input, null, 2));
        
        // Run the best channels scraper
        const run = await client.actor('scrape-creators/best-youtube-channels-scraper').call(input);
        
        // Fetch and return results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        console.log(`✅ Best scraper results: ${items.length} items`);
        if (items.length > 0) {
            console.log('📊 Sample result structure:', Object.keys(items[0]));
            console.log('📄 First result:', JSON.stringify(items[0], null, 2));
        }
        
        return {
            success: true,
            itemCount: items.length,
            sampleData: items[0] || null,
            fullData: items
        };
        
    } catch (error) {
        console.error('❌ Best scraper error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Generate comprehensive test report
 */
function generateApifyTestReport(results) {
    console.log('\n\n📋 [APIFY-TEST-REPORT] Comprehensive Apify YouTube API Test Results');
    console.log('=' .repeat(100));
    
    console.log(`\n📊 [SUMMARY]`);
    console.log(`Total channels tested: ${results.length}`);
    
    results.forEach((result, index) => {
        console.log(`\n🎯 [CHANNEL-${index + 1}] ${result.channel.name} (@${result.channel.username}) - ${result.channel.niche}`);
        console.log('-'.repeat(60));
        
        if (result.error) {
            console.log(`❌ Testing failed: ${result.error}`);
            return;
        }
        
        // Main scraper results
        if (result.mainScraper?.success) {
            console.log(`✅ Main Scraper: ${result.mainScraper.itemCount} items`);
            if (result.mainScraper.sampleData) {
                console.log(`   Sample keys: ${Object.keys(result.mainScraper.sampleData).join(', ')}`);
            }
        } else {
            console.log(`❌ Main Scraper: ${result.mainScraper?.error || 'Failed'}`);
        }
        
        // Fast scraper results
        if (result.fastScraper?.success) {
            console.log(`✅ Fast Scraper: ${result.fastScraper.itemCount} items`);
            if (result.fastScraper.sampleData) {
                console.log(`   Sample keys: ${Object.keys(result.fastScraper.sampleData).join(', ')}`);
            }
        } else {
            console.log(`❌ Fast Scraper: ${result.fastScraper?.error || 'Failed'}`);
        }
        
        // Best scraper results
        if (result.bestScraper?.success) {
            console.log(`✅ Best Scraper: ${result.bestScraper.itemCount} items`);
            if (result.bestScraper.sampleData) {
                console.log(`   Sample keys: ${Object.keys(result.bestScraper.sampleData).join(', ')}`);
            }
        } else {
            console.log(`❌ Best Scraper: ${result.bestScraper?.error || 'Failed'}`);
        }
    });
    
    console.log(`\n🔍 [ANALYSIS] What We Found:`);
    
    // Analyze which scrapers found related/similar channel data
    let foundSimilarChannels = false;
    results.forEach(result => {
        if (result.mainScraper?.sampleData || result.fastScraper?.sampleData || result.bestScraper?.sampleData) {
            // Check if any scraper returned related channel data
            const allData = [
                result.mainScraper?.sampleData,
                result.fastScraper?.sampleData, 
                result.bestScraper?.sampleData
            ].filter(Boolean);
            
            allData.forEach(data => {
                const keys = Object.keys(data).join(' ').toLowerCase();
                if (keys.includes('related') || keys.includes('similar') || keys.includes('featured') || keys.includes('channel')) {
                    foundSimilarChannels = true;
                    console.log(`   🎯 Found potential similar channel data in: ${Object.keys(data).join(', ')}`);
                }
            });
        }
    });
    
    if (!foundSimilarChannels) {
        console.log(`   ❌ No direct similar/related channel data found in any scraper`);
        console.log(`   💡 Recommendation: We may need to stick with keyword-based approach or find alternative APIs`);
    } else {
        console.log(`   ✅ Found potential similar channel data!`);
        console.log(`   💡 Recommendation: Investigate the promising scraper further`);
    }
    
    console.log(`\n💾 [SAVE] Detailed results available in test output above`);
}

// Run tests if called directly
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();
    
    if (!process.env.APIFY_TOKEN) {
        console.error('❌ APIFY_TOKEN environment variable is required');
        console.log('💡 Get your token from: https://console.apify.com/account/integrations');
        process.exit(1);
    }
    
    testApifyYouTubeScrapers()
        .then(results => {
            console.log('\n✅ [APIFY-TEST] All tests completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ [APIFY-TEST] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    testApifyYouTubeScrapers
};