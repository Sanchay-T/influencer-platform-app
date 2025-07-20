#!/usr/bin/env node

/**
 * Direct Unit Economics Test
 * 
 * Tests the platform handlers directly to analyze unit economics without auth
 * This simulates what happens during the actual processing to understand:
 * 1. Raw API response sizes
 * 2. Filtration rates
 * 3. Processing efficiency
 */

const fs = require('fs');

// Mock SystemConfig for testing
const mockSystemConfig = {
  get: async (category, key) => {
    const configs = {
      'api_limits': {
        'max_api_calls_for_testing': 1,
        'max_api_calls_tiktok_similar': 1
      },
      'timeouts': {
        'standard_job_timeout': 3600000, // 1 hour
        'profile_fetch_timeout': 10000   // 10 seconds
      }
    };
    return configs[category]?.[key] || 1;
  }
};

// Mock database for testing
const mockDb = {
  insert: () => ({ values: () => Promise.resolve({ id: 'test-job-id' }) }),
  update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  query: {
    scrapingJobs: {
      findFirst: () => Promise.resolve({
        id: 'test-job-id',
        processedRuns: 0,
        processedResults: 0,
        targetResults: 100,
        status: 'processing'
      })
    }
  }
};

// Mock QStash for testing
const mockQStash = {
  publishJSON: async (payload) => {
    console.log('📤 [MOCK-QSTASH] Would schedule next call:', payload.delay);
    return { messageId: 'mock-message-id' };
  }
};

/**
 * Test TikTok Keyword Search Processing Logic
 */
async function testTikTokKeywordLogic() {
  console.log('\n🧪 Testing TikTok Keyword Search Logic');
  
  // Simulate API response structure based on actual code
  const mockApiResponse = {
    cursor: 123456,
    search_item_list: Array.from({ length: 25 }, (_, i) => ({
      aweme_info: {
        author: {
          nickname: `Creator${i + 1}`,
          unique_id: `creator${i + 1}`,
          avatar_medium: {
            url_list: [`https://example.com/avatar${i + 1}.jpg`]
          },
          follower_count: Math.floor(Math.random() * 100000) + 1000,
          signature: i % 3 === 0 ? `Bio for creator ${i + 1}` : undefined // Some have bios, some don't
        },
        text_extra: [
          { type: 1, hashtag_name: 'trending' },
          { type: 1, hashtag_name: 'viral' }
        ],
        share_url: `https://tiktok.com/@creator${i + 1}/video/123`,
        desc: `Video description ${i + 1}`,
        statistics: {
          play_count: Math.floor(Math.random() * 1000000),
          digg_count: Math.floor(Math.random() * 50000),
          comment_count: Math.floor(Math.random() * 5000),
          share_count: Math.floor(Math.random() * 10000)
        },
        create_time: Date.now() - (i * 3600000) // Spread over time
      }
    }))
  };
  
  console.log(`📊 Raw API Response: ${mockApiResponse.search_item_list.length} items`);
  
  // Simulate the processing logic from the actual code
  let creatorsWithBio = 0;
  let creatorsNeedingEnhancement = 0;
  let finalCreators = [];
  
  for (const item of mockApiResponse.search_item_list) {
    const author = item.aweme_info.author;
    let bio = author.signature || '';
    
    if (!bio) {
      creatorsNeedingEnhancement++;
      // Simulate enhanced bio fetching (some succeed, some fail)
      if (Math.random() > 0.3) { // 70% success rate for bio enhancement
        bio = `Enhanced bio for ${author.unique_id} with contact info`;
        if (Math.random() > 0.6) { // 40% have emails
          bio += ' - contact@example.com';
        }
      }
    }
    
    if (bio) creatorsWithBio++;
    
    // Extract emails using the same regex from actual code
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const extractedEmails = bio.match(emailRegex) || [];
    
    finalCreators.push({
      creator: {
        name: author.nickname,
        followers: author.follower_count,
        bio: bio,
        emails: extractedEmails,
        uniqueId: author.unique_id
      },
      video: {
        description: item.aweme_info.desc,
        url: item.aweme_info.share_url,
        statistics: item.aweme_info.statistics
      },
      platform: 'TikTok'
    });
  }
  
  const analysis = {
    platform: 'TikTok',
    searchType: 'keyword',
    rawApiResults: mockApiResponse.search_item_list.length,
    finalCreators: finalCreators.length,
    creatorsWithBio: creatorsWithBio,
    creatorsWithEmail: finalCreators.filter(c => c.creator.emails.length > 0).length,
    creatorsNeedingEnhancement: creatorsNeedingEnhancement,
    enhancementSuccessRate: creatorsNeedingEnhancement > 0 ? (creatorsWithBio / (mockApiResponse.search_item_list.length)) : 1,
    efficiencyRate: finalCreators.length / mockApiResponse.search_item_list.length,
    estimatedCallsFor100: Math.ceil(100 / finalCreators.length),
    estimatedCallsFor500: Math.ceil(500 / finalCreators.length),
    estimatedCallsFor1000: Math.ceil(1000 / finalCreators.length)
  };
  
  console.log('📈 Analysis:', JSON.stringify(analysis, null, 2));
  return analysis;
}

/**
 * Test Instagram Reels Search Logic
 */
async function testInstagramReelsLogic() {
  console.log('\n🧪 Testing Instagram Reels Search Logic');
  
  // Simulate API response structure
  const mockApiResponse = {
    reels_serp_modules: Array.from({ length: 50 }, (_, i) => ({
      reels_media: Array.from({ length: 1 }, (_, j) => ({
        media: {
          id: `reel_${i}_${j}`,
          code: `ABC${i}${j}`,
          caption: { text: `Reel caption ${i + 1}` },
          like_count: Math.floor(Math.random() * 10000),
          comment_count: Math.floor(Math.random() * 1000),
          play_count: Math.floor(Math.random() * 100000),
          user: {
            id: `user_${i}`,
            username: `creator${i + 1}`,
            full_name: `Creator ${i + 1}`,
            is_verified: Math.random() > 0.8, // 20% verified
            is_private: Math.random() > 0.7,  // 30% private
            profile_pic_url: `https://example.com/profile${i}.jpg`,
            follower_count: Math.floor(Math.random() * 50000) + 100 // 100 to 50k followers
          }
        }
      }))
    }))
  };
  
  console.log(`📊 Raw API Response: ${mockApiResponse.reels_serp_modules.length} reels`);
  
  // Simulate the filtration logic from actual code
  const allReels = mockApiResponse.reels_serp_modules.flatMap(module => 
    module.reels_media.map(item => item.media)
  );
  
  console.log(`📊 Total reels extracted: ${allReels.length}`);
  
  // Apply primary filter (from actual code logic)
  const primaryFiltered = allReels.filter(media => {
    const user = media.user;
    return user.is_verified || (!user.is_private && user.username);
  });
  
  console.log(`📊 After primary filter: ${primaryFiltered.length}`);
  
  // Apply secondary quality filter (300+ followers OR verified)
  const secondaryFiltered = primaryFiltered.filter(media => {
    const user = media.user;
    return user.is_verified || user.follower_count >= 300 || (!user.is_private && user.follower_count >= 50);
  });
  
  console.log(`📊 After secondary filter: ${secondaryFiltered.length}`);
  
  // Simulate bio enhancement for remaining creators
  let creatorsWithEnhancedBio = 0;
  let creatorsWithEmail = 0;
  
  const finalCreators = secondaryFiltered.map(media => {
    const user = media.user;
    let enhancedBio = '';
    let emails = [];
    
    // Simulate bio enhancement (60% success rate)
    if (Math.random() > 0.4) {
      enhancedBio = `Enhanced bio for ${user.username}`;
      creatorsWithEnhancedBio++;
      
      // 30% have emails
      if (Math.random() > 0.7) {
        emails = [`${user.username}@example.com`];
        creatorsWithEmail++;
      }
    }
    
    return {
      creator: {
        name: user.full_name || user.username,
        uniqueId: user.username,
        followers: user.follower_count,
        avatarUrl: user.profile_pic_url,
        bio: enhancedBio,
        emails: emails
      },
      video: {
        description: media.caption?.text || '',
        url: `https://www.instagram.com/reel/${media.code}`,
        statistics: {
          likes: media.like_count,
          comments: media.comment_count,
          views: media.play_count
        }
      },
      platform: 'Instagram'
    };
  });
  
  const analysis = {
    platform: 'Instagram',
    searchType: 'reels',
    rawApiResults: allReels.length,
    afterPrimaryFilter: primaryFiltered.length,
    afterSecondaryFilter: secondaryFiltered.length,
    finalCreators: finalCreators.length,
    creatorsWithBio: creatorsWithEnhancedBio,
    creatorsWithEmail: creatorsWithEmail,
    primaryFilterRate: 1 - (primaryFiltered.length / allReels.length),
    secondaryFilterRate: 1 - (secondaryFiltered.length / primaryFiltered.length),
    overallFilterRate: 1 - (finalCreators.length / allReels.length),
    efficiencyRate: finalCreators.length / allReels.length,
    estimatedCallsFor100: Math.ceil(100 / finalCreators.length),
    estimatedCallsFor500: Math.ceil(500 / finalCreators.length),
    estimatedCallsFor1000: Math.ceil(1000 / finalCreators.length)
  };
  
  console.log('📈 Analysis:', JSON.stringify(analysis, null, 2));
  return analysis;
}

/**
 * Test TikTok Similar Search Logic
 */
async function testTikTokSimilarLogic() {
  console.log('\n🧪 Testing TikTok Similar Search Logic');
  
  // Simulate the multi-keyword search approach
  const keywords = ['apple tech', 'apple', 'tech apple', 'technology'];
  let allUsers = [];
  
  for (const keyword of keywords) {
    // Simulate API response for each keyword
    const mockSearchResponse = {
      users: Array.from({ length: 15 }, (_, i) => ({
        user_info: {
          uid: `uid_${keyword.replace(' ', '_')}_${i}`,
          unique_id: `user_${keyword.replace(' ', '_')}_${i}`,
          nickname: `Creator ${keyword} ${i + 1}`,
          verification_type: Math.random() > 0.9 ? 1 : 0, // 10% verified
          avatar_medium: {
            url_list: [`https://example.com/avatar_${i}.jpg`]
          },
          follower_count: Math.floor(Math.random() * 100000) + 500,
          search_user_desc: i % 4 === 0 ? `Bio for ${keyword} creator ${i}` : '' // 25% have basic bio
        }
      }))
    };
    
    allUsers.push(...mockSearchResponse.users);
  }
  
  console.log(`📊 Raw results from ${keywords.length} keywords: ${allUsers.length} users`);
  
  // Apply deduplication (from actual code)
  const uniqueUsers = [];
  const seenIds = new Set();
  
  for (const userItem of allUsers) {
    const userId = userItem.user_info.uid;
    if (!seenIds.has(userId)) {
      seenIds.add(userId);
      uniqueUsers.push(userItem);
    }
  }
  
  console.log(`📊 After deduplication: ${uniqueUsers.length} unique users`);
  
  // Apply privacy filter
  const publicUsers = uniqueUsers.filter(userItem => {
    // Simulate privacy check (assume 80% are public)
    return Math.random() > 0.2;
  });
  
  console.log(`📊 After privacy filter: ${publicUsers.length} public users`);
  
  // Take top 10 by follower count (from actual code)
  const topUsers = publicUsers
    .sort((a, b) => b.user_info.follower_count - a.user_info.follower_count)
    .slice(0, 10);
  
  console.log(`📊 Top 10 by followers: ${topUsers.length} users`);
  
  // Simulate bio enhancement
  let enhancedUsers = 0;
  let usersWithEmail = 0;
  
  const finalCreators = topUsers.map(userItem => {
    const userInfo = userItem.user_info;
    let bio = userInfo.search_user_desc || '';
    
    // Simulate enhanced bio fetching (70% success rate)
    if (!bio || Math.random() > 0.3) {
      bio = `Enhanced bio for ${userInfo.unique_id}`;
      enhancedUsers++;
      
      // 35% have emails
      if (Math.random() > 0.65) {
        bio += ' - contact@example.com';
        usersWithEmail++;
      }
    }
    
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const emails = bio.match(emailRegex) || [];
    
    return {
      id: userInfo.uid,
      username: userInfo.unique_id,
      full_name: userInfo.nickname,
      is_verified: userInfo.verification_type > 0,
      profile_pic_url: userInfo.avatar_medium?.url_list?.[0] || '',
      bio: bio,
      emails: emails,
      platform: 'TikTok'
    };
  });
  
  const analysis = {
    platform: 'TikTok',
    searchType: 'similar',
    keywordsSearched: keywords.length,
    rawApiResults: allUsers.length,
    afterDeduplication: uniqueUsers.length,
    afterPrivacyFilter: publicUsers.length,
    finalCreators: finalCreators.length,
    creatorsWithBio: enhancedUsers,
    creatorsWithEmail: usersWithEmail,
    deduplicationRate: 1 - (uniqueUsers.length / allUsers.length),
    privacyFilterRate: 1 - (publicUsers.length / uniqueUsers.length),
    overallFilterRate: 1 - (finalCreators.length / allUsers.length),
    efficiencyRate: finalCreators.length / keywords.length, // Per keyword efficiency
    estimatedCallsFor100: Math.ceil(100 / finalCreators.length),
    estimatedCallsFor500: Math.ceil(500 / finalCreators.length),
    estimatedCallsFor1000: Math.ceil(1000 / finalCreators.length)
  };
  
  console.log('📈 Analysis:', JSON.stringify(analysis, null, 2));
  return analysis;
}

/**
 * Test YouTube Keyword Search Logic
 */
async function testYouTubeKeywordLogic() {
  console.log('\n🧪 Testing YouTube Keyword Search Logic');
  
  // Simulate API response
  const mockApiResponse = {
    videos: Array.from({ length: 20 }, (_, i) => ({
      title: `Video Title ${i + 1}`,
      url: `https://youtube.com/watch?v=abc${i}`,
      viewCountInt: Math.floor(Math.random() * 1000000),
      lengthSeconds: Math.floor(Math.random() * 600) + 60,
      publishedTime: `${i + 1} days ago`,
      channel: {
        title: `Channel ${i + 1}`,
        thumbnail: `https://example.com/channel${i}.jpg`,
        handle: `@channel${i + 1}`
      }
    }))
  };
  
  console.log(`📊 Raw API Response: ${mockApiResponse.videos.length} videos`);
  
  // Simulate channel profile enhancement
  let enhancedChannels = 0;
  let channelsWithEmail = 0;
  
  const finalCreators = mockApiResponse.videos.map(video => {
    let channelBio = '';
    let emails = [];
    
    // Simulate channel profile fetching (80% success rate)
    if (Math.random() > 0.2) {
      channelBio = `Channel description for ${video.channel.title}`;
      enhancedChannels++;
      
      // 25% have emails
      if (Math.random() > 0.75) {
        emails = [`contact@${video.channel.handle.slice(1)}.com`];
        channelsWithEmail++;
      }
    }
    
    return {
      creator: {
        name: video.channel.title,
        followers: 0, // Not available in search API
        avatarUrl: video.channel.thumbnail,
        bio: channelBio,
        emails: emails
      },
      video: {
        description: video.title,
        url: video.url,
        statistics: {
          views: video.viewCountInt,
          likes: 0, comments: 0 // Not available in search API
        }
      },
      lengthSeconds: video.lengthSeconds,
      publishedTime: video.publishedTime,
      platform: 'YouTube'
    };
  });
  
  const analysis = {
    platform: 'YouTube',
    searchType: 'keyword',
    rawApiResults: mockApiResponse.videos.length,
    finalCreators: finalCreators.length,
    channelsWithBio: enhancedChannels,
    channelsWithEmail: channelsWithEmail,
    enhancementSuccessRate: enhancedChannels / mockApiResponse.videos.length,
    efficiencyRate: 1.0, // No filtering, 1:1 video to creator
    estimatedCallsFor100: Math.ceil(100 / finalCreators.length),
    estimatedCallsFor500: Math.ceil(500 / finalCreators.length),
    estimatedCallsFor1000: Math.ceil(1000 / finalCreators.length)
  };
  
  console.log('📈 Analysis:', JSON.stringify(analysis, null, 2));
  return analysis;
}

/**
 * Generate comprehensive summary and recommendations
 */
function generateSummary(results) {
  console.log('\n📊 COMPREHENSIVE UNIT ECONOMICS ANALYSIS');
  console.log('=' .repeat(60));
  
  const summary = {
    timestamp: new Date().toISOString(),
    totalPlatformsCombinations: results.length,
    results: results,
    recommendations: [],
    productionEstimates: {}
  };
  
  console.log('\n📋 PLATFORM EFFICIENCY TABLE:');
  console.table(results.map(r => ({
    Platform: `${r.platform} ${r.searchType}`,
    'Raw Results': r.rawApiResults,
    'Final Creators': r.finalCreators,
    'Efficiency Rate': `${Math.round(r.efficiencyRate * 100)}%`,
    'Calls for 100': r.estimatedCallsFor100,
    'Calls for 500': r.estimatedCallsFor500,
    'Calls for 1000': r.estimatedCallsFor1000
  })));
  
  // Generate recommendations
  results.forEach(r => {
    const platformKey = `${r.platform}_${r.searchType}`;
    
    if (r.estimatedCallsFor1000 > 50) {
      summary.recommendations.push(`⚠️  ${platformKey}: Need ${r.estimatedCallsFor1000} calls for 1000 creators (>50 limit)`);
    }
    
    if (r.efficiencyRate < 0.3) {
      summary.recommendations.push(`📉 ${platformKey}: Low efficiency (${Math.round(r.efficiencyRate * 100)}%)`);
    }
    
    if (r.finalCreators < 10) {
      summary.recommendations.push(`🔢 ${platformKey}: Low yield (${r.finalCreators} creators/call)`);
    }
    
    // Store production estimates
    summary.productionEstimates[platformKey] = {
      creatorsPerCall: r.finalCreators,
      callsFor100: r.estimatedCallsFor100,
      callsFor500: r.estimatedCallsFor500,
      callsFor1000: r.estimatedCallsFor1000,
      recommendedMaxCalls: Math.min(50, r.estimatedCallsFor1000)
    };
  });
  
  console.log('\n💡 RECOMMENDATIONS:');
  summary.recommendations.forEach(rec => console.log(rec));
  
  console.log('\n🎯 PRODUCTION API LIMITS STRATEGY:');
  Object.entries(summary.productionEstimates).forEach(([platform, estimates]) => {
    console.log(`${platform}:`);
    console.log(`  - Development: 1 call (testing)`);
    console.log(`  - Production: Dynamic based on slider`);
    console.log(`    • 100 creators: ${estimates.callsFor100} calls`);
    console.log(`    • 500 creators: ${estimates.callsFor500} calls`);
    console.log(`    • 1000 creators: ${estimates.callsFor1000} calls (cap at 50)`);
  });
  
  return summary;
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Direct Unit Economics Analysis');
  console.log('This simulates the actual processing logic without auth');
  
  const results = [];
  
  try {
    // Run all platform tests
    results.push(await testTikTokKeywordLogic());
    results.push(await testInstagramReelsLogic());
    results.push(await testTikTokSimilarLogic());
    results.push(await testYouTubeKeywordLogic());
    
    // Generate comprehensive analysis
    const summary = generateSummary(results);
    
    // Save results
    const filename = `unit-economics-analysis-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(summary, null, 2));
    
    console.log(`\n📁 Results saved to: ${filename}`);
    
    return summary;
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    throw error;
  }
}

// Run the tests
runAllTests().catch(console.error);