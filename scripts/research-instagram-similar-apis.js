#!/usr/bin/env node

/**
 * Comprehensive Instagram Similar Creator API Research Script
 * Tests multiple providers and approaches for finding similar Instagram creators
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../test-outputs/instagram-similar-research');
const TEST_USERNAMES = ['redbull', 'nike', 'cocacola']; // Different profile types to test

console.log('🔬 Instagram Similar Creator API Research');
console.log('=' . repeat(60));
console.log(`📊 Testing ${TEST_USERNAMES.length} different profiles`);
console.log(`📁 Output directory: ${OUTPUT_DIR}`);
console.log('');

// Helper function
String.prototype.repeat = function(count) {
    return new Array(count + 1).join(this);
};

async function createOutputDir() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

// 1. Test ScrapeCreators Instagram API (Current Implementation)
async function testScrapeCreatorsInstagram(username) {
    console.log(`\n🔍 Testing ScrapeCreators Instagram API for @${username}`);
    
    try {
        const apiUrl = `${process.env.SCRAPECREATORS_INSTAGRAM_API_URL}?handle=${encodeURIComponent(username)}`;
        
        console.log(`📡 Calling: ${apiUrl.replace(process.env.SCRAPECREATORS_API_KEY, '[REDACTED]')}`);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'x-api-key': process.env.SCRAPECREATORS_API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Analyze the response
        const analysis = {
            timestamp: new Date().toISOString(),
            username: username,
            provider: 'ScrapeCreators',
            success: true,
            mainProfile: data.data?.user ? {
                username: data.data.user.username,
                fullName: data.data.user.full_name,
                hasProfilePic: !!data.data.user.profile_pic_url_hd
            } : null,
            relatedProfiles: {
                found: !!data.data?.user?.edge_related_profiles?.edges,
                count: data.data?.user?.edge_related_profiles?.edges?.length || 0,
                profiles: data.data?.user?.edge_related_profiles?.edges?.slice(0, 5).map(edge => ({
                    username: edge.node.username,
                    fullName: edge.node.full_name,
                    verified: edge.node.is_verified,
                    private: edge.node.is_private
                })) || []
            },
            dataQuality: {
                hasFollowerCounts: false,
                hasBioData: false,
                hasEmailData: false,
                hasContactInfo: false
            },
            suitableForSimilarSearch: data.data?.user?.edge_related_profiles?.edges?.length > 0
        };

        // Save detailed response
        await fs.writeFile(
            path.join(OUTPUT_DIR, `scrapecreators-${username}-detailed.json`),
            JSON.stringify(data, null, 2)
        );

        console.log(`✅ ScrapeCreators - Found ${analysis.relatedProfiles.count} related profiles`);
        return analysis;

    } catch (error) {
        console.error(`❌ ScrapeCreators failed: ${error.message}`);
        return {
            timestamp: new Date().toISOString(),
            username: username,
            provider: 'ScrapeCreators',
            success: false,
            error: error.message,
            suitableForSimilarSearch: false
        };
    }
}

// 2. Test Apify Instagram Profile Scraper
async function testApifyProfileScraper(username) {
    console.log(`\n🔍 Testing Apify Instagram Profile Scraper for @${username}`);
    
    try {
        const { ApifyClient } = require('apify-client');
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        const input = {
            usernames: [username],
            resultsLimit: 1,
            addParentData: true
        };

        console.log(`🚀 Starting Apify actor: ${process.env.INSTAGRAM_SCRAPER_ACTOR_ID || 'dSCLg0C3YEZ83HzYX'}`);
        
        const run = await client
            .actor(process.env.INSTAGRAM_SCRAPER_ACTOR_ID || 'dSCLg0C3YEZ83HzYX')
            .start(input);

        console.log(`⏳ Waiting for completion... (Run ID: ${run.id})`);
        await client.run(run.id).waitForFinish();

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (items.length === 0) {
            throw new Error('No profile data returned');
        }

        const profileData = items[0];
        
        // Analyze the response
        const analysis = {
            timestamp: new Date().toISOString(),
            username: username,
            provider: 'Apify Profile Scraper',
            success: true,
            mainProfile: {
                username: profileData.username,
                fullName: profileData.fullName,
                followersCount: profileData.followersCount,
                biography: profileData.biography?.substring(0, 100) + '...',
                verified: profileData.verified,
                businessEmail: profileData.businessEmail,
                externalUrl: profileData.externalUrl
            },
            relatedProfiles: {
                found: !!profileData.relatedProfiles,
                count: profileData.relatedProfiles?.length || 0,
                profiles: profileData.relatedProfiles?.slice(0, 5).map(profile => ({
                    username: profile.username,
                    fullName: profile.full_name,
                    verified: profile.is_verified,
                    private: profile.is_private
                })) || []
            },
            dataQuality: {
                hasFollowerCounts: !!profileData.followersCount,
                hasBioData: !!profileData.biography,
                hasEmailData: !!profileData.businessEmail,
                hasContactInfo: !!(profileData.businessEmail || profileData.externalUrl)
            },
            suitableForSimilarSearch: profileData.relatedProfiles?.length > 0
        };

        // Save detailed response
        await fs.writeFile(
            path.join(OUTPUT_DIR, `apify-profile-${username}-detailed.json`),
            JSON.stringify(profileData, null, 2)
        );

        console.log(`✅ Apify Profile - Found ${analysis.relatedProfiles.count} related profiles`);
        return analysis;

    } catch (error) {
        console.error(`❌ Apify Profile Scraper failed: ${error.message}`);
        return {
            timestamp: new Date().toISOString(),
            username: username,
            provider: 'Apify Profile Scraper',
            success: false,
            error: error.message,
            suitableForSimilarSearch: false
        };
    }
}

// 3. Research other Apify Instagram actors
async function researchApifyInstagramActors() {
    console.log('\n🔍 Researching other Apify Instagram actors...');
    
    try {
        const { ApifyClient } = require('apify-client');
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        // Search for Instagram-related actors
        const actors = await client.actors().list({
            search: 'instagram',
            limit: 20
        });

        const instagramActors = actors.items.filter(actor => 
            actor.name.toLowerCase().includes('instagram') &&
            (actor.name.toLowerCase().includes('profile') || 
             actor.name.toLowerCase().includes('search') ||
             actor.name.toLowerCase().includes('scraper'))
        );

        console.log(`📊 Found ${instagramActors.length} relevant Instagram actors:`);
        
        instagramActors.forEach((actor, i) => {
            console.log(`   ${i + 1}. ${actor.name} (${actor.id})`);
            console.log(`      Description: ${(actor.description || 'N/A').substring(0, 100)}...`);
            console.log(`      Author: ${actor.username}`);
            console.log('');
        });

        // Save detailed list
        await fs.writeFile(
            path.join(OUTPUT_DIR, 'apify-instagram-actors.json'),
            JSON.stringify(instagramActors, null, 2)
        );

        return instagramActors;

    } catch (error) {
        console.error(`❌ Failed to research Apify actors: ${error.message}`);
        return [];
    }
}

// 4. Test Alternative Instagram Search Actor (if found)
async function testAlternativeInstagramActors(username, actors) {
    console.log(`\n🔍 Testing alternative Instagram actors for @${username}`);
    
    const searchActor = actors.find(actor => 
        actor.name.toLowerCase().includes('search') && 
        !actor.name.toLowerCase().includes('profile')
    );

    if (!searchActor) {
        console.log('⚠️ No alternative search actors found');
        return null;
    }

    try {
        const { ApifyClient } = require('apify-client');
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        // Try different input formats
        const inputOptions = [
            { search: username, searchType: 'user', resultsLimit: 10 },
            { usernames: [username], resultsLimit: 10 },
            { directUrls: [`https://www.instagram.com/${username}/`] }
        ];

        for (const input of inputOptions) {
            try {
                console.log(`🧪 Testing ${searchActor.name} with input:`, input);
                
                const run = await client.actor(searchActor.id).start(input);
                await client.run(run.id).waitForFinish();
                const { items } = await client.dataset(run.defaultDatasetId).listItems();

                if (items.length > 0) {
                    console.log(`✅ ${searchActor.name} - Success with ${items.length} items`);
                    
                    // Save sample response
                    await fs.writeFile(
                        path.join(OUTPUT_DIR, `${searchActor.name.replace(/\s+/g, '-')}-${username}.json`),
                        JSON.stringify({ input, items: items.slice(0, 5) }, null, 2)
                    );
                    
                    return { actor: searchActor, success: true, itemCount: items.length };
                }
            } catch (err) {
                console.log(`❌ ${searchActor.name} failed with this input: ${err.message}`);
            }
        }

        return { actor: searchActor, success: false };

    } catch (error) {
        console.error(`❌ Alternative actor test failed: ${error.message}`);
        return null;
    }
}

// Main research function
async function runComprehensiveResearch() {
    await createOutputDir();
    
    const results = {
        timestamp: new Date().toISOString(),
        testUsernames: TEST_USERNAMES,
        providers: {},
        summary: {
            totalTests: 0,
            successfulTests: 0,
            bestProvider: null,
            recommendations: []
        }
    };

    // Research available actors first
    console.log('\n📋 STEP 1: Research Available Actors');
    const availableActors = await researchApifyInstagramActors();

    // Test each username with each provider
    for (const username of TEST_USERNAMES) {
        console.log('\n' + '='.repeat(50));
        console.log(`🎯 Testing username: @${username}`);
        console.log('='.repeat(50));

        const userResults = {
            scrapeCreators: await testScrapeCreatorsInstagram(username),
            apifyProfile: await testApifyProfileScraper(username),
            alternatives: await testAlternativeInstagramActors(username, availableActors)
        };

        results.providers[username] = userResults;
    }

    // Generate summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESEARCH SUMMARY');
    console.log('='.repeat(60));

    const providers = ['scrapeCreators', 'apifyProfile'];
    const providerStats = {};

    providers.forEach(provider => {
        const stats = {
            totalTests: TEST_USERNAMES.length,
            successful: 0,
            withRelatedProfiles: 0,
            averageRelatedProfiles: 0,
            dataQualityScore: 0
        };

        let totalRelatedProfiles = 0;
        let totalQualityScore = 0;

        TEST_USERNAMES.forEach(username => {
            const result = results.providers[username][provider];
            if (result.success) {
                stats.successful++;
                if (result.suitableForSimilarSearch) {
                    stats.withRelatedProfiles++;
                    totalRelatedProfiles += result.relatedProfiles?.count || 0;
                }
                
                // Calculate data quality score
                if (result.dataQuality) {
                    const qualityFactors = Object.values(result.dataQuality).filter(Boolean).length;
                    totalQualityScore += qualityFactors;
                }
            }
        });

        stats.averageRelatedProfiles = stats.withRelatedProfiles > 0 ? 
            Math.round(totalRelatedProfiles / stats.withRelatedProfiles) : 0;
        stats.dataQualityScore = Math.round(totalQualityScore / stats.totalTests);

        providerStats[provider] = stats;

        console.log(`\n📈 ${provider.toUpperCase()} Results:`);
        console.log(`   Success Rate: ${stats.successful}/${stats.totalTests} (${Math.round(stats.successful/stats.totalTests*100)}%)`);
        console.log(`   Related Profiles Found: ${stats.withRelatedProfiles}/${stats.totalTests} profiles`);
        console.log(`   Average Related Profiles: ${stats.averageRelatedProfiles}`);
        console.log(`   Data Quality Score: ${stats.dataQualityScore}/4`);
    });

    // Determine best provider
    let bestProvider = null;
    let bestScore = 0;

    Object.entries(providerStats).forEach(([provider, stats]) => {
        // Score based on success rate, related profiles found, and data quality
        const score = (stats.successful / stats.totalTests) * 0.4 + 
                     (stats.withRelatedProfiles / stats.totalTests) * 0.4 + 
                     (stats.dataQualityScore / 4) * 0.2;
        
        if (score > bestScore) {
            bestScore = score;
            bestProvider = provider;
        }
    });

    results.summary = {
        totalTests: TEST_USERNAMES.length * providers.length,
        providerStats,
        bestProvider,
        recommendations: generateRecommendations(providerStats)
    };

    // Save comprehensive results
    await fs.writeFile(
        path.join(OUTPUT_DIR, 'comprehensive-research-results.json'),
        JSON.stringify(results, null, 2)
    );

    console.log(`\n🏆 RECOMMENDATION: ${bestProvider} appears to be the best option`);
    console.log('\n📋 Next Steps:');
    results.summary.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
    });

    console.log(`\n📁 All detailed results saved to: ${OUTPUT_DIR}`);
    
    return results;
}

function generateRecommendations(providerStats) {
    const recommendations = [];
    
    const scrapeCreators = providerStats.scrapeCreators;
    const apifyProfile = providerStats.apifyProfile;

    if (apifyProfile.withRelatedProfiles > scrapeCreators.withRelatedProfiles) {
        recommendations.push('Use Apify Profile Scraper as primary method for related profiles');
    }

    if (apifyProfile.dataQualityScore > scrapeCreators.dataQualityScore) {
        recommendations.push('Apify provides richer data (followers, bio, emails) for better creator insights');
    }

    if (scrapeCreators.successful > 0 && apifyProfile.successful > 0) {
        recommendations.push('Implement hybrid approach: Apify primary, ScrapeCreators fallback');
    }

    if (apifyProfile.averageRelatedProfiles > 5) {
        recommendations.push('Apify provides sufficient related profiles for meaningful similar search');
    }

    recommendations.push('Test with more diverse Instagram profiles to validate results');
    recommendations.push('Consider cost analysis between providers');

    return recommendations;
}

// Run the research
runComprehensiveResearch()
    .then(() => {
        console.log('\n✨ Research completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Research failed:', error);
        process.exit(1);
    }); 