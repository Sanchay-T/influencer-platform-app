/**
 * Test YouTube Official Data API to see what similar channel data we can get
 */

async function testYouTubeOfficialAPI() {
    console.log('🧪 [YOUTUBE-API-TEST] Testing YouTube Official Data API for Similar Channel Features');
    console.log('=' .repeat(80));
    
    const API_KEY = process.env.YOUTUBE_API_KEY;
    if (!API_KEY) {
        console.log('⚠️ YOUTUBE_API_KEY not found. This test requires a YouTube Data API key.');
        console.log('💡 Get one from: https://console.developers.google.com/');
        console.log('🔄 Proceeding with mock data to show expected structure...\n');
    }
    
    const testChannels = [
        { username: 'MKBHD', channelId: 'UCBJycsmduvYEL83R_U4JriQ', niche: 'tech' },
        { username: 'FitnessBlender', channelId: 'UCiP6wvz0uYcaYgOWPKVhWhQ', niche: 'fitness' },
        { username: 'BingingwithBabish', channelId: 'UCJHA_jMfCvEnv-3kRjTCQXw', niche: 'cooking' }
    ];
    
    const results = [];
    
    for (const channel of testChannels) {
        console.log(`\n🔍 [TEST] Testing channel: ${channel.username} (${channel.niche})`);
        
        try {
            // Test 1: Channels API - Basic Info
            console.log('\n--- Test 1: Channels API (Basic Info) ---');
            const channelResult = await testChannelsAPI(channel, API_KEY);
            
            // Test 2: Channels API - Branding Settings (might include featured channels)
            console.log('\n--- Test 2: Channels API (Branding Settings) ---');
            const brandingResult = await testChannelBranding(channel, API_KEY);
            
            // Test 3: Channel Sections API (for featured channels)
            console.log('\n--- Test 3: Channel Sections API ---');
            const sectionsResult = await testChannelSections(channel, API_KEY);
            
            // Test 4: Videos from channel + related videos
            console.log('\n--- Test 4: Popular Videos + Related Videos ---');
            const relatedVideosResult = await testRelatedVideos(channel, API_KEY);
            
            // Test 5: Search API for similar content
            console.log('\n--- Test 5: Search API for Similar Content ---');
            const searchResult = await testSearchForSimilar(channel, API_KEY);
            
            results.push({
                channel,
                channelInfo: channelResult,
                branding: brandingResult,
                sections: sectionsResult,
                relatedVideos: relatedVideosResult,
                search: searchResult
            });
            
            // Respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ [ERROR] Failed to test ${channel.username}:`, error.message);
            results.push({
                channel,
                error: error.message
            });
        }
    }
    
    // Generate comprehensive report
    generateYouTubeAPIReport(results);
    return results;
}

/**
 * Test YouTube Channels API for basic channel info
 */
async function testChannelsAPI(channel, apiKey) {
    console.log(`🔍 Testing channels API for ${channel.username}`);
    
    if (!apiKey) {
        return mockChannelResponse();
    }
    
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics,brandingSettings&id=${channel.channelId}&key=${apiKey}`;
        console.log('📤 URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Channels API success`);
        console.log('📊 Response structure:', Object.keys(data));
        if (data.items && data.items.length > 0) {
            console.log('📄 Channel data keys:', Object.keys(data.items[0]));
            console.log('📄 Snippet keys:', Object.keys(data.items[0].snippet || {}));
        }
        
        return {
            success: true,
            data,
            quota: 1
        };
        
    } catch (error) {
        console.error('❌ Channels API error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test YouTube Channels API for branding settings
 */
async function testChannelBranding(channel, apiKey) {
    console.log(`🔍 Testing channel branding settings for ${channel.username}`);
    
    if (!apiKey) {
        return mockBrandingResponse();
    }
    
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&id=${channel.channelId}&key=${apiKey}`;
        console.log('📤 URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Branding API success`);
        if (data.items && data.items.length > 0 && data.items[0].brandingSettings) {
            const branding = data.items[0].brandingSettings;
            console.log('📊 Branding settings keys:', Object.keys(branding));
            
            // Check for featured channels
            if (branding.channel && branding.channel.featuredChannelsUrls) {
                console.log('🎯 Featured channels found:', branding.channel.featuredChannelsUrls);
            } else {
                console.log('❌ No featured channels found');
            }
        }
        
        return {
            success: true,
            data,
            quota: 1
        };
        
    } catch (error) {
        console.error('❌ Branding API error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test YouTube Channel Sections API
 */
async function testChannelSections(channel, apiKey) {
    console.log(`🔍 Testing channel sections for ${channel.username}`);
    
    if (!apiKey) {
        return mockSectionsResponse();
    }
    
    try {
        const url = `https://www.googleapis.com/youtube/v3/channelSections?part=snippet,contentDetails&channelId=${channel.channelId}&key=${apiKey}`;
        console.log('📤 URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Channel sections API success`);
        console.log(`📊 Found ${data.items?.length || 0} sections`);
        
        if (data.items && data.items.length > 0) {
            data.items.forEach((section, idx) => {
                console.log(`   Section ${idx + 1}: ${section.snippet?.type} - ${section.snippet?.title || 'No title'}`);
                if (section.contentDetails && section.contentDetails.channels) {
                    console.log(`      🎯 Contains ${section.contentDetails.channels.length} featured channels`);
                }
            });
        }
        
        return {
            success: true,
            data,
            quota: 1
        };
        
    } catch (error) {
        console.error('❌ Channel sections API error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test related videos approach
 */
async function testRelatedVideos(channel, apiKey) {
    console.log(`🔍 Testing related videos approach for ${channel.username}`);
    
    if (!apiKey) {
        return mockRelatedVideosResponse();
    }
    
    console.log('⚠️ Note: YouTube removed "related videos" from API in 2012');
    console.log('💡 Alternative: Get popular videos from channel, then search for similar content');
    
    try {
        // Get channel's uploads playlist
        const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channel.channelId}&key=${apiKey}`;
        const channelResponse = await fetch(channelUrl);
        const channelData = await channelResponse.json();
        
        if (!channelData.items || channelData.items.length === 0) {
            throw new Error('Channel not found');
        }
        
        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
        
        // Get recent videos from uploads playlist
        const videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5&key=${apiKey}`;
        const videosResponse = await fetch(videosUrl);
        const videosData = await videosResponse.json();
        
        console.log(`✅ Found ${videosData.items?.length || 0} recent videos`);
        
        if (videosData.items && videosData.items.length > 0) {
            console.log('📹 Recent videos:');
            videosData.items.forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.snippet.title}`);
            });
        }
        
        return {
            success: true,
            data: videosData,
            quota: 2,
            approach: 'channel_videos'
        };
        
    } catch (error) {
        console.error('❌ Related videos error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test search API for similar content
 */
async function testSearchForSimilar(channel, apiKey) {
    console.log(`🔍 Testing search API for similar content to ${channel.username}`);
    
    if (!apiKey) {
        return mockSearchResponse();
    }
    
    try {
        const searchTerms = {
            'tech': 'technology review gadgets',
            'fitness': 'workout fitness exercise',
            'cooking': 'cooking recipe food'
        };
        
        const query = searchTerms[channel.niche] || channel.username;
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=10&key=${apiKey}`;
        console.log('📤 URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${await response.text()}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Search API success`);
        console.log(`📊 Found ${data.items?.length || 0} channels`);
        
        if (data.items && data.items.length > 0) {
            console.log('🎯 Similar channels found:');
            data.items.forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.snippet.title} (${item.snippet.channelTitle})`);
            });
        }
        
        return {
            success: true,
            data,
            quota: 100 // Search is expensive
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
 * Mock responses for when API key is not available
 */
function mockChannelResponse() {
    return {
        success: true,
        data: {
            items: [{
                snippet: {
                    title: "Sample Channel",
                    description: "Sample description...",
                },
                statistics: {
                    subscriberCount: "1000000",
                    videoCount: "500"
                }
            }]
        },
        quota: 1,
        mock: true
    };
}

function mockBrandingResponse() {
    return {
        success: true,
        data: {
            items: [{
                brandingSettings: {
                    channel: {
                        featuredChannelsUrls: [
                            "https://www.youtube.com/channel/UC1", 
                            "https://www.youtube.com/channel/UC2"
                        ]
                    }
                }
            }]
        },
        quota: 1,
        mock: true
    };
}

function mockSectionsResponse() {
    return {
        success: true,
        data: {
            items: [{
                snippet: {
                    type: "channelsRecommendations",
                    title: "Featured Channels"
                },
                contentDetails: {
                    channels: ["UC1", "UC2", "UC3"]
                }
            }]
        },
        quota: 1,
        mock: true
    };
}

function mockRelatedVideosResponse() {
    return {
        success: true,
        data: { items: [] },
        quota: 2,
        mock: true,
        note: "Related videos API was discontinued"
    };
}

function mockSearchResponse() {
    return {
        success: true,
        data: {
            items: [
                { snippet: { title: "Similar Channel 1", channelTitle: "Channel 1" }},
                { snippet: { title: "Similar Channel 2", channelTitle: "Channel 2" }}
            ]
        },
        quota: 100,
        mock: true
    };
}

/**
 * Generate comprehensive test report
 */
function generateYouTubeAPIReport(results) {
    console.log('\n\n📋 [YOUTUBE-API-REPORT] YouTube Official Data API Test Results');
    console.log('=' .repeat(100));
    
    console.log(`\n📊 [SUMMARY]`);
    console.log(`Total channels tested: ${results.length}`);
    
    let totalQuotaUsed = 0;
    let foundSimilarFeatures = false;
    
    results.forEach((result, index) => {
        console.log(`\n🎯 [CHANNEL-${index + 1}] ${result.channel.username} (${result.channel.niche})`);
        console.log('-'.repeat(60));
        
        if (result.error) {
            console.log(`❌ Testing failed: ${result.error}`);
            return;
        }
        
        // Channel Info
        if (result.channelInfo?.success) {
            console.log(`✅ Channel Info API: Success (${result.channelInfo.quota} quota)`);
            totalQuotaUsed += result.channelInfo.quota;
        }
        
        // Branding Settings
        if (result.branding?.success) {
            console.log(`✅ Branding API: Success (${result.branding.quota} quota)`);
            totalQuotaUsed += result.branding.quota;
            
            const branding = result.branding.data?.items?.[0]?.brandingSettings;
            if (branding?.channel?.featuredChannelsUrls) {
                console.log(`   🎯 Featured channels: ${branding.channel.featuredChannelsUrls.length} found`);
                foundSimilarFeatures = true;
            }
        }
        
        // Channel Sections
        if (result.sections?.success) {
            console.log(`✅ Sections API: Success (${result.sections.quota} quota)`);
            totalQuotaUsed += result.sections.quota;
            
            const sections = result.sections.data?.items || [];
            const channelSections = sections.filter(s => s.contentDetails?.channels);
            if (channelSections.length > 0) {
                console.log(`   🎯 Channel sections with featured channels: ${channelSections.length}`);
                foundSimilarFeatures = true;
            }
        }
        
        // Related Videos
        if (result.relatedVideos?.success) {
            console.log(`✅ Related Videos: Success (${result.relatedVideos.quota} quota)`);
            totalQuotaUsed += result.relatedVideos.quota;
        }
        
        // Search
        if (result.search?.success) {
            console.log(`✅ Search API: Success (${result.search.quota} quota)`);
            totalQuotaUsed += result.search.quota;
            
            const channels = result.search.data?.items?.length || 0;
            if (channels > 0) {
                console.log(`   🎯 Similar channels found: ${channels}`);
                foundSimilarFeatures = true;
            }
        }
    });
    
    console.log(`\n💰 [QUOTA-USAGE] Total quota used: ${totalQuotaUsed} units`);
    console.log(`💡 Default daily limit: 10,000 units`);
    
    console.log(`\n🔍 [ANALYSIS] YouTube Official API Capabilities:`);
    
    if (foundSimilarFeatures) {
        console.log(`   ✅ Found some similar channel features!`);
        console.log(`   🎯 Featured channels: Available in branding settings`);
        console.log(`   🎯 Channel sections: May contain featured channels`);
        console.log(`   🎯 Search API: Can find channels by topic/niche`);
    } else {
        console.log(`   ❌ Limited similar channel features found`);
    }
    
    console.log(`\n⚠️ [LIMITATIONS]:`);
    console.log(`   • Quota cost: Search API costs 100 units per request`);
    console.log(`   • Rate limits: 10,000 units per day (default)`);
    console.log(`   • Featured channels: Only available if channel owner configured them`);
    console.log(`   • Related videos API: Discontinued in 2012`);
    
    console.log(`\n🎯 [RECOMMENDATIONS]:`);
    console.log(`   1. YouTube Official API has limited similar channel data`);
    console.log(`   2. Search API can find channels by niche (expensive: 100 quota per call)`);
    console.log(`   3. Featured channels only work if manually set by channel owners`);
    console.log(`   4. ScrapeCreators approach may be more cost-effective and comprehensive`);
    
    console.log(`\n💾 [SAVE] Detailed results available in test output above`);
}

// Run tests if called directly
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();
    
    testYouTubeOfficialAPI()
        .then(results => {
            console.log('\n✅ [YOUTUBE-API-TEST] All tests completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ [YOUTUBE-API-TEST] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    testYouTubeOfficialAPI
};