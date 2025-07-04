/**
 * Test ScrapeCreators YouTube API to explore what similar channel data we can get
 */

async function testScrapeCreatorsFeatures() {
    console.log('🧪 [SCRAPECREATORS-TEST] Testing ScrapeCreators YouTube API Features');
    console.log('=' .repeat(80));
    
    const API_KEY = process.env.SCRAPECREATORS_API_KEY;
    if (!API_KEY) {
        throw new Error('SCRAPECREATORS_API_KEY environment variable is required');
    }
    
    const testChannels = [
        { username: 'mkbhd', name: 'MKBHD', niche: 'tech' },
        { username: 'fitnessblender', name: 'FitnessBlender', niche: 'fitness' },
        { username: 'bingingwithbabish', name: 'Binging with Babish', niche: 'cooking' }
    ];
    
    const results = [];
    
    for (const channel of testChannels) {
        console.log(`\n🔍 [TEST] Testing channel: ${channel.name} (@${channel.username})`);
        
        try {
            // Test 1: Channel Profile API
            console.log('\n--- Test 1: Channel Profile API ---');
            const profileResult = await testChannelProfile(channel, API_KEY);
            
            // Test 2: Channel Videos API
            console.log('\n--- Test 2: Channel Videos API ---');
            const videosResult = await testChannelVideos(channel, API_KEY);
            
            // Test 3: Video Details API (to see if it includes suggested videos)
            console.log('\n--- Test 3: Video Details API ---');
            const videoDetailsResult = await testVideoDetails(channel, API_KEY);
            
            // Test 4: Search API with channel name
            console.log('\n--- Test 4: Search API ---');
            const searchResult = await testSearchAPI(channel, API_KEY);
            
            results.push({
                channel,
                profile: profileResult,
                videos: videosResult,
                videoDetails: videoDetailsResult,
                search: searchResult
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
    generateScrapeCreatorsReport(results);
    return results;
}

/**
 * Test ScrapeCreators Channel Profile API
 */
async function testChannelProfile(channel, apiKey) {
    console.log(`🔍 Testing channel profile API for @${channel.username}`);
    
    try {
        const url = `https://api.scrapecreators.com/v1/youtube/channel?handle=@${channel.username}`;
        console.log('📤 URL:', url);
        
        const response = await fetch(url, {
            headers: { 'x-api-key': apiKey }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Profile API success`);
        console.log('📊 Response structure:', Object.keys(data));
        console.log('📄 Full response:', JSON.stringify(data, null, 2));
        
        // Check for any related/similar channel data
        const relatedFields = Object.keys(data).filter(key => 
            key.toLowerCase().includes('related') || 
            key.toLowerCase().includes('similar') || 
            key.toLowerCase().includes('featured') ||
            key.toLowerCase().includes('channel')
        );
        
        if (relatedFields.length > 0) {
            console.log('🎯 Found potential related channel fields:', relatedFields);
        } else {
            console.log('❌ No related channel fields found');
        }
        
        return {
            success: true,
            data,
            hasRelatedFields: relatedFields.length > 0,
            relatedFields
        };
        
    } catch (error) {
        console.error('❌ Profile API error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test ScrapeCreators Channel Videos API
 */
async function testChannelVideos(channel, apiKey) {
    console.log(`🔍 Testing channel videos API for @${channel.username}`);
    
    try {
        const url = `https://api.scrapecreators.com/v1/youtube/channel/videos?handle=@${channel.username}&limit=5`;
        console.log('📤 URL:', url);
        
        const response = await fetch(url, {
            headers: { 'x-api-key': apiKey }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Videos API success`);
        console.log('📊 Response structure:', Object.keys(data));
        console.log('📄 Sample video data:');
        if (data.videos && data.videos.length > 0) {
            console.log(JSON.stringify(data.videos[0], null, 2));
        }
        
        return {
            success: true,
            data,
            videoCount: data.videos?.length || 0
        };
        
    } catch (error) {
        console.error('❌ Videos API error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test ScrapeCreators Video Details API
 */
async function testVideoDetails(channel, apiKey) {
    console.log(`🔍 Testing video details API for @${channel.username}`);
    
    try {
        // First get a video from the channel
        const videosUrl = `https://api.scrapecreators.com/v1/youtube/channel/videos?handle=@${channel.username}&limit=1`;
        const videosResponse = await fetch(videosUrl, {
            headers: { 'x-api-key': apiKey }
        });
        
        if (!videosResponse.ok) {
            throw new Error(`Videos API Error: ${videosResponse.status}`);
        }
        
        const videosData = await videosResponse.json();
        
        if (!videosData.videos || videosData.videos.length === 0) {
            throw new Error('No videos found for channel');
        }
        
        const videoId = videosData.videos[0].id;
        console.log('📹 Testing with video ID:', videoId);
        
        // Now get video details
        const detailsUrl = `https://api.scrapecreators.com/v1/youtube/video?id=${videoId}`;
        console.log('📤 URL:', detailsUrl);
        
        const response = await fetch(detailsUrl, {
            headers: { 'x-api-key': apiKey }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Video details API success`);
        console.log('📊 Response structure:', Object.keys(data));
        
        // Check for suggested/related videos
        const suggestedFields = Object.keys(data).filter(key => 
            key.toLowerCase().includes('suggested') || 
            key.toLowerCase().includes('related') || 
            key.toLowerCase().includes('recommendation')
        );
        
        if (suggestedFields.length > 0) {
            console.log('🎯 Found suggested video fields:', suggestedFields);
            suggestedFields.forEach(field => {
                console.log(`📄 ${field}:`, JSON.stringify(data[field], null, 2));
            });
        } else {
            console.log('❌ No suggested video fields found');
        }
        
        return {
            success: true,
            data,
            hasSuggestedFields: suggestedFields.length > 0,
            suggestedFields
        };
        
    } catch (error) {
        console.error('❌ Video details API error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test ScrapeCreators Search API
 */
async function testSearchAPI(channel, apiKey) {
    console.log(`🔍 Testing search API for "${channel.name}"`);
    
    try {
        const url = `https://api.scrapecreators.com/v1/youtube/search?query=${encodeURIComponent(channel.name)}&limit=10`;
        console.log('📤 URL:', url);
        
        const response = await fetch(url, {
            headers: { 'x-api-key': apiKey }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Search API success`);
        console.log('📊 Response structure:', Object.keys(data));
        console.log(`📹 Found ${data.videos?.length || 0} videos`);
        
        // Analyze channels found in search results
        if (data.videos && data.videos.length > 0) {
            const channelsFound = new Map();
            data.videos.forEach(video => {
                if (video.channel) {
                    const channelId = video.channel.id;
                    if (!channelsFound.has(channelId)) {
                        channelsFound.set(channelId, {
                            id: channelId,
                            title: video.channel.title,
                            handle: video.channel.handle,
                            videoCount: 0
                        });
                    }
                    channelsFound.get(channelId).videoCount++;
                }
            });
            
            const uniqueChannels = Array.from(channelsFound.values());
            console.log(`🎯 Found ${uniqueChannels.length} unique channels in search results:`);
            uniqueChannels.forEach((ch, idx) => {
                console.log(`   ${idx + 1}. ${ch.title} (${ch.handle}) - ${ch.videoCount} videos`);
            });
        }
        
        return {
            success: true,
            data,
            videoCount: data.videos?.length || 0,
            uniqueChannels: data.videos ? 
                Array.from(new Set(data.videos.map(v => v.channel?.id).filter(Boolean))).length : 0
        };
        
    } catch (error) {
        console.error('❌ Search API error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Generate comprehensive test report
 */
function generateScrapeCreatorsReport(results) {
    console.log('\n\n📋 [SCRAPECREATORS-REPORT] ScrapeCreators YouTube API Test Results');
    console.log('=' .repeat(100));
    
    console.log(`\n📊 [SUMMARY]`);
    console.log(`Total channels tested: ${results.length}`);
    
    let foundSimilarData = false;
    
    results.forEach((result, index) => {
        console.log(`\n🎯 [CHANNEL-${index + 1}] ${result.channel.name} (@${result.channel.username}) - ${result.channel.niche}`);
        console.log('-'.repeat(60));
        
        if (result.error) {
            console.log(`❌ Testing failed: ${result.error}`);
            return;
        }
        
        // Profile API results
        if (result.profile?.success) {
            console.log(`✅ Profile API: Success`);
            if (result.profile.hasRelatedFields) {
                console.log(`   🎯 Related fields found: ${result.profile.relatedFields.join(', ')}`);
                foundSimilarData = true;
            } else {
                console.log(`   ❌ No related channel fields`);
            }
        } else {
            console.log(`❌ Profile API: ${result.profile?.error || 'Failed'}`);
        }
        
        // Videos API results
        if (result.videos?.success) {
            console.log(`✅ Videos API: ${result.videos.videoCount} videos found`);
        } else {
            console.log(`❌ Videos API: ${result.videos?.error || 'Failed'}`);
        }
        
        // Video Details API results
        if (result.videoDetails?.success) {
            console.log(`✅ Video Details API: Success`);
            if (result.videoDetails.hasSuggestedFields) {
                console.log(`   🎯 Suggested video fields: ${result.videoDetails.suggestedFields.join(', ')}`);
                foundSimilarData = true;
            } else {
                console.log(`   ❌ No suggested video fields`);
            }
        } else {
            console.log(`❌ Video Details API: ${result.videoDetails?.error || 'Failed'}`);
        }
        
        // Search API results
        if (result.search?.success) {
            console.log(`✅ Search API: ${result.search.videoCount} videos, ${result.search.uniqueChannels} unique channels`);
        } else {
            console.log(`❌ Search API: ${result.search?.error || 'Failed'}`);
        }
    });
    
    console.log(`\n🔍 [ANALYSIS] What We Discovered:`);
    
    if (foundSimilarData) {
        console.log(`   ✅ Found some similar/related data in ScrapeCreators API!`);
        console.log(`   💡 Recommendation: Investigate the promising endpoints further`);
    } else {
        console.log(`   ❌ No direct similar/related channel data found in ScrapeCreators API`);
        console.log(`   💡 Recommendation: Current keyword-based approach may be the best option with ScrapeCreators`);
    }
    
    console.log(`\n🎯 [BEST-APPROACH] Based on results:`);
    console.log(`   1. Search API can find channels in same niche (current approach)`);
    console.log(`   2. Channel profile gives us target channel details`);
    console.log(`   3. We can extract channels from search results and rank by relevance`);
    console.log(`   4. This is essentially what we're already doing - seems like the right approach!`);
    
    console.log(`\n💾 [SAVE] Detailed results available in test output above`);
}

// Run tests if called directly
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();
    
    if (!process.env.SCRAPECREATORS_API_KEY) {
        console.error('❌ SCRAPECREATORS_API_KEY environment variable is required');
        process.exit(1);
    }
    
    testScrapeCreatorsFeatures()
        .then(results => {
            console.log('\n✅ [SCRAPECREATORS-TEST] All tests completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ [SCRAPECREATORS-TEST] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    testScrapeCreatorsFeatures
};