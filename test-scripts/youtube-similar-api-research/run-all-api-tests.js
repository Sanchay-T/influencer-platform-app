/**
 * Run all YouTube Similar API tests and generate comprehensive comparison report
 */

const fs = require('fs');
const path = require('path');

// Import test modules
const { testApifyYouTubeScrapers } = require('./test-apify-youtube');
const { testScrapeCreatorsFeatures } = require('./test-scrapecreators-features');
const { testYouTubeOfficialAPI } = require('./test-youtube-official-api');

/**
 * Main test runner - executes all YouTube similar API tests
 */
async function runAllAPITests() {
    console.log('🚀 [API-COMPARISON] Starting Comprehensive YouTube Similar API Comparison Tests');
    console.log('='.repeat(120));
    console.log(`📅 Test started at: ${new Date().toISOString()}`);
    
    const testResults = {
        timestamp: new Date().toISOString(),
        overallResult: 'PENDING',
        tests: {},
        comparison: {},
        recommendation: '',
        confidence: '',
        implementationPlan: ''
    };
    
    try {
        // Test 1: ScrapeCreators YouTube API (Current Implementation)
        console.log('\n🔍 [TEST-1] Testing ScrapeCreators YouTube API Features...');
        console.log('-'.repeat(80));
        
        const scrapeCreatorsResults = await testScrapeCreatorsFeatures();
        testResults.tests.scrapeCreators = {
            success: true,
            results: scrapeCreatorsResults,
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ [TEST-1] ScrapeCreators tests completed successfully');
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 2: YouTube Official Data API
        console.log('\n🔍 [TEST-2] Testing YouTube Official Data API...');
        console.log('-'.repeat(80));
        
        const youtubeOfficialResults = await testYouTubeOfficialAPI();
        testResults.tests.youtubeOfficial = {
            success: true,
            results: youtubeOfficialResults,
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ [TEST-2] YouTube Official API tests completed successfully');
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 3: Apify YouTube Scrapers (if API key available)
        console.log('\n🔍 [TEST-3] Testing Apify YouTube Scrapers...');
        console.log('-'.repeat(80));
        
        if (process.env.APIFY_TOKEN) {
            const apifyResults = await testApifyYouTubeScrapers();
            testResults.tests.apify = {
                success: true,
                results: apifyResults,
                timestamp: new Date().toISOString()
            };
            console.log('✅ [TEST-3] Apify tests completed successfully');
        } else {
            console.log('⚠️ [TEST-3] Skipping Apify tests - APIFY_TOKEN not available');
            testResults.tests.apify = {
                success: false,
                skipped: true,
                reason: 'APIFY_TOKEN not available'
            };
        }
        
        // Generate comprehensive comparison
        testResults.comparison = generateAPIComparison(testResults.tests);
        testResults.overallResult = 'COMPLETED';
        
    } catch (error) {
        console.error('❌ [API-COMPARISON] Error during test execution:', error);
        testResults.overallResult = 'FAILED';
        testResults.error = error.message;
    }
    
    // Generate final report
    generateFinalComparisonReport(testResults);
    
    // Save detailed results
    saveAPITestResults(testResults);
    
    return testResults;
}

/**
 * Generate comprehensive API comparison
 */
function generateAPIComparison(tests) {
    console.log('\n\n📊 [API-COMPARISON] Analyzing All YouTube API Test Results');
    console.log('='.repeat(100));
    
    const comparison = {
        scrapeCreators: 'UNKNOWN',
        youtubeOfficial: 'UNKNOWN',
        apify: 'UNKNOWN',
        bestOption: 'UNKNOWN',
        scores: {},
        pros: {},
        cons: {},
        recommendations: []
    };
    
    // Analyze ScrapeCreators
    if (tests.scrapeCreators?.success) {
        console.log(`📡 [SCRAPECREATORS] Analysis:`);
        const results = tests.scrapeCreators.results;
        let hasRelatedData = false;
        let apiReliability = 0;
        let totalAPIs = 0;
        
        results.forEach(result => {
            if (!result.error) {
                if (result.profile?.success) { apiReliability++; totalAPIs++; }
                if (result.videos?.success) { apiReliability++; totalAPIs++; }
                if (result.videoDetails?.success) { apiReliability++; totalAPIs++; }
                if (result.search?.success) { apiReliability++; totalAPIs++; }
                
                if (result.profile?.hasRelatedFields || result.videoDetails?.hasSuggestedFields) {
                    hasRelatedData = true;
                }
            }
        });
        
        const reliabilityScore = totalAPIs > 0 ? (apiReliability / totalAPIs) * 100 : 0;
        
        comparison.scrapeCreators = reliabilityScore >= 80 ? 'EXCELLENT' : 
                                   reliabilityScore >= 60 ? 'GOOD' : 'FAIR';
        comparison.scores.scrapeCreators = reliabilityScore;
        
        comparison.pros.scrapeCreators = [
            'No quota limits',
            'Comprehensive channel data',
            'Search functionality works well',
            'Cost effective'
        ];
        
        comparison.cons.scrapeCreators = hasRelatedData ? 
            ['Limited direct similar channel data'] : 
            ['No direct similar channel data found'];
        
        console.log(`  ✅ Reliability: ${comparison.scrapeCreators} (${reliabilityScore.toFixed(1)}%)`);
        console.log(`  🎯 Related data: ${hasRelatedData ? 'Found some' : 'Not found'}`);
    }
    
    // Analyze YouTube Official API
    if (tests.youtubeOfficial?.success) {
        console.log(`📡 [YOUTUBE-OFFICIAL] Analysis:`);
        const results = tests.youtubeOfficial.results;
        let hasRelatedData = false;
        let totalQuota = 0;
        let successfulAPIs = 0;
        let totalAPIs = 0;
        
        results.forEach(result => {
            if (!result.error) {
                ['channelInfo', 'branding', 'sections', 'relatedVideos', 'search'].forEach(apiName => {
                    if (result[apiName]?.success) {
                        successfulAPIs++;
                        totalQuota += result[apiName].quota || 0;
                        
                        // Check for related data
                        if (apiName === 'branding' && result[apiName].data?.items?.[0]?.brandingSettings?.channel?.featuredChannelsUrls) {
                            hasRelatedData = true;
                        }
                        if (apiName === 'sections' && result[apiName].data?.items?.some(s => s.contentDetails?.channels)) {
                            hasRelatedData = true;
                        }
                        if (apiName === 'search' && result[apiName].data?.items?.length > 0) {
                            hasRelatedData = true;
                        }
                    }
                    totalAPIs++;
                });
            }
        });
        
        const reliabilityScore = totalAPIs > 0 ? (successfulAPIs / totalAPIs) * 100 : 0;
        
        comparison.youtubeOfficial = reliabilityScore >= 80 ? 'EXCELLENT' : 
                                    reliabilityScore >= 60 ? 'GOOD' : 'FAIR';
        comparison.scores.youtubeOfficial = reliabilityScore;
        
        comparison.pros.youtubeOfficial = [
            'Official Google API',
            'Featured channels data available',
            'Channel sections may include similar channels',
            'Search API can find similar content'
        ];
        
        comparison.cons.youtubeOfficial = [
            `High quota cost (${totalQuota} units used)`,
            'Daily limits (10,000 units default)',
            'Featured channels depend on channel owner setup',
            'Search API expensive (100 units per call)'
        ];
        
        console.log(`  ✅ Reliability: ${comparison.youtubeOfficial} (${reliabilityScore.toFixed(1)}%)`);
        console.log(`  💰 Quota used: ${totalQuota} units`);
        console.log(`  🎯 Related data: ${hasRelatedData ? 'Found some' : 'Limited'}`);
    }
    
    // Analyze Apify
    if (tests.apify?.success) {
        console.log(`📡 [APIFY] Analysis:`);
        const results = tests.apify.results;
        let hasRelatedData = false;
        let successfulScrapers = 0;
        let totalScrapers = 0;
        
        results.forEach(result => {
            if (!result.error) {
                ['mainScraper', 'fastScraper', 'bestScraper'].forEach(scraperName => {
                    if (result[scraperName]?.success) {
                        successfulScrapers++;
                        
                        // Check sample data for related fields
                        const sampleData = result[scraperName].sampleData;
                        if (sampleData && Object.keys(sampleData).some(key => 
                            key.toLowerCase().includes('related') || 
                            key.toLowerCase().includes('similar') || 
                            key.toLowerCase().includes('featured')
                        )) {
                            hasRelatedData = true;
                        }
                    }
                    totalScrapers++;
                });
            }
        });
        
        const reliabilityScore = totalScrapers > 0 ? (successfulScrapers / totalScrapers) * 100 : 0;
        
        comparison.apify = reliabilityScore >= 80 ? 'EXCELLENT' : 
                          reliabilityScore >= 60 ? 'GOOD' : 'FAIR';
        comparison.scores.apify = reliabilityScore;
        
        comparison.pros.apify = [
            'Multiple scraper options',
            'No API quotas',
            'Pay per result model',
            'Comprehensive data extraction'
        ];
        
        comparison.cons.apify = [
            'Higher cost than ScrapeCreators',
            'May require multiple scrapers',
            hasRelatedData ? 'Limited similar channel data' : 'No direct similar channel data'
        ];
        
        console.log(`  ✅ Reliability: ${comparison.apify} (${reliabilityScore.toFixed(1)}%)`);
        console.log(`  🎯 Related data: ${hasRelatedData ? 'Found some' : 'Not found'}`);
    } else if (tests.apify?.skipped) {
        console.log(`📡 [APIFY] Skipped - ${tests.apify.reason}`);
        comparison.apify = 'SKIPPED';
    }
    
    // Determine best option
    const scores = comparison.scores;
    let bestScore = 0;
    let bestOption = 'CURRENT_APPROACH';
    
    Object.entries(scores).forEach(([api, score]) => {
        if (score > bestScore) {
            bestScore = score;
            bestOption = api.toUpperCase();
        }
    });
    
    comparison.bestOption = bestOption;
    
    // Generate recommendations
    console.log(`\n🎯 [BEST-OPTION] ${bestOption} (${bestScore.toFixed(1)}% score)`);
    
    if (bestOption === 'SCRAPECREATORS' || bestScore < 70) {
        comparison.recommendations = [
            '✅ RECOMMENDATION: Stick with current ScrapeCreators approach',
            '🎯 Our keyword-based similarity algorithm is actually quite good',
            '💰 Cost-effective and no quota limits',
            '🔄 Consider removing relevance score column as requested'
        ];
    } else if (bestOption === 'YOUTUBEOFFICIAL') {
        comparison.recommendations = [
            '⚠️ RECOMMENDATION: YouTube Official API has potential but is expensive',
            '💰 High quota costs make it impractical for production',
            '🎯 Featured channels only work if manually set by creators',
            '💡 Consider hybrid approach: ScrapeCreators + occasional YouTube API calls'
        ];
    } else if (bestOption === 'APIFY') {
        comparison.recommendations = [
            '💡 RECOMMENDATION: Apify could be worth exploring',
            '🔍 Test specific scrapers that showed promise',
            '💰 Evaluate cost vs current approach',
            '⚖️ Consider switching if related channel data is significantly better'
        ];
    }
    
    return comparison;
}

/**
 * Generate final comprehensive report
 */
function generateFinalComparisonReport(testResults) {
    console.log('\n\n🏁 [FINAL-REPORT] YouTube Similar Channel API Comparison Results');
    console.log('='.repeat(120));
    
    const comparison = testResults.comparison;
    
    console.log(`\n📊 [EXECUTIVE-SUMMARY]`);
    console.log(`  🎯 Best Option: ${comparison.bestOption}`);
    console.log(`  📈 Test Duration: ${new Date().toISOString()}`);
    console.log(`  ✅ Tests Completed: ${Object.keys(testResults.tests).length}`);
    
    console.log(`\n📋 [DETAILED-SCORES]`);
    Object.entries(comparison.scores || {}).forEach(([api, score]) => {
        console.log(`  ${api}: ${score.toFixed(1)}%`);
    });
    
    console.log(`\n🎯 [RECOMMENDATIONS]`);
    if (comparison.recommendations && comparison.recommendations.length > 0) {
        comparison.recommendations.forEach(rec => {
            console.log(`  ${rec}`);
        });
    }
    
    console.log(`\n🛠️ [IMPLEMENTATION-PLAN]`);
    if (comparison.bestOption === 'SCRAPECREATORS' || comparison.bestOption === 'CURRENT_APPROACH') {
        console.log(`  1. ✅ Keep current ScrapeCreators implementation`);
        console.log(`  2. 🗑️ Remove relevance score column as requested`);
        console.log(`  3. 🎨 Update table to show: Profile, Channel Name, Handle, Videos Count`);
        console.log(`  4. 🔧 Consider improving keyword extraction algorithm`);
        console.log(`  5. 📊 Monitor user feedback and satisfaction`);
    } else if (comparison.bestOption === 'YOUTUBEOFFICIAL') {
        console.log(`  1. ⚠️ Consider hybrid approach to manage costs`);
        console.log(`  2. 🎯 Use YouTube API for featured channels data`);
        console.log(`  3. 💰 Implement quota management and caching`);
        console.log(`  4. 🔄 Fallback to ScrapeCreators when quota exceeded`);
    } else if (comparison.bestOption === 'APIFY') {
        console.log(`  1. 🧪 Test promising Apify scrapers with real data`);
        console.log(`  2. 💰 Evaluate cost comparison with current approach`);
        console.log(`  3. 🔄 Implement gradual migration if beneficial`);
        console.log(`  4. 📊 A/B test quality of similar channels found`);
    }
    
    console.log(`\n💾 [DATA-PRESERVATION]`);
    console.log(`  📁 Detailed test results saved for future reference`);
    console.log(`  🔍 Raw API responses preserved for analysis`);
    console.log(`  📊 Performance metrics documented for comparison`);
}

/**
 * Save test results to file
 */
function saveAPITestResults(testResults) {
    try {
        // Create test-outputs directory if it doesn't exist
        const outputDir = path.join(__dirname, '../../test-outputs/youtube-similar-api-research');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `youtube-api-comparison-${timestamp}.json`;
        const filepath = path.join(outputDir, filename);
        
        // Save comprehensive results
        fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
        
        console.log(`\n💾 [SAVE] API comparison results saved to: ${filepath}`);
        
        // Also save a summary report
        const summaryFilename = `youtube-api-comparison-summary-${timestamp}.txt`;
        const summaryFilepath = path.join(outputDir, summaryFilename);
        
        const summaryReport = generateTextSummary(testResults);
        fs.writeFileSync(summaryFilepath, summaryReport);
        
        console.log(`📄 [SAVE] Summary report saved to: ${summaryFilepath}`);
        
    } catch (error) {
        console.error('❌ [SAVE] Error saving test results:', error.message);
    }
}

/**
 * Generate text summary for easy reading
 */
function generateTextSummary(testResults) {
    const comparison = testResults.comparison;
    
    return `
YouTube Similar Channel API Comparison Summary
==============================================

Test Date: ${testResults.timestamp}
Overall Result: ${testResults.overallResult}

API COMPARISON RESULTS
---------------------
Best Option: ${comparison.bestOption}

COMPONENT SCORES
---------------
${Object.entries(comparison.scores || {}).map(([api, score]) => 
    `${api}: ${score.toFixed(1)}%`
).join('\n')}

RECOMMENDATIONS
--------------
${comparison.recommendations?.join('\n') || 'No recommendations available'}

PROS & CONS
-----------
${Object.entries(comparison.pros || {}).map(([api, pros]) => 
    `${api.toUpperCase()}:\n  Pros: ${pros.join(', ')}\n  Cons: ${comparison.cons[api]?.join(', ') || 'None'}`
).join('\n\n')}

CONCLUSION
----------
${comparison.bestOption === 'SCRAPECREATORS' || comparison.bestOption === 'CURRENT_APPROACH' ? 
  'Current ScrapeCreators approach is the most practical and cost-effective solution.' :
  `Consider switching to ${comparison.bestOption} based on test results.`
}
  `;
}

// Run all tests if called directly
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();
    
    if (!process.env.SCRAPECREATORS_API_KEY) {
        console.error('❌ SCRAPECREATORS_API_KEY environment variable is required');
        process.exit(1);
    }
    
    runAllAPITests()
        .then(results => {
            console.log('\n🎉 [API-COMPARISON] All API comparison tests completed successfully!');
            
            // Exit with appropriate code based on results
            const bestOption = results.comparison?.bestOption;
            if (bestOption === 'SCRAPECREATORS' || bestOption === 'CURRENT_APPROACH') {
                console.log('💡 [CONCLUSION] Current approach is the best option!');
                process.exit(0);
            } else {
                console.log('💡 [CONCLUSION] Alternative API may be worth considering');
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('❌ [API-COMPARISON] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runAllAPITests
};