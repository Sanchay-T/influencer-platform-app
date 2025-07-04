#!/usr/bin/env node

/**
 * Quick Test Script for Instagram APIs
 * Test individual APIs quickly for development
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const OUTPUT_DIR = path.join(__dirname, '../test-outputs');

// Test configuration
const TEST_USERNAME = process.argv[2] || 'redbull';
const API_TO_TEST = process.argv[3] || 'both'; // 'scrapecreators', 'apify', or 'both'

console.log(`🚀 Quick Instagram API Test for @${TEST_USERNAME}`);
console.log(`🎯 Testing: ${API_TO_TEST}`);
console.log('');

async function testScrapeCreators(username) {
    console.log('🔍 Testing ScrapeCreators Instagram API...');
    
    const startTime = Date.now();
    
    try {
        const apiUrl = `${process.env.SCRAPECREATORS_INSTAGRAM_API_URL}?handle=${encodeURIComponent(username)}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'x-api-key': process.env.SCRAPECREATORS_API_KEY
            }
        });

        const endTime = Date.now();
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Quick analysis
        const relatedCount = data.data?.user?.edge_related_profiles?.edges?.length || 0;
        const mainProfile = data.data?.user;
        
        console.log('✅ ScrapeCreators Results:');
        console.log(`   Response Time: ${endTime - startTime}ms`);
        console.log(`   Main Profile: @${mainProfile?.username} (${mainProfile?.full_name})`);
        console.log(`   Related Profiles: ${relatedCount}`);
        
        if (relatedCount > 0) {
            console.log('   Sample Related:');
            data.data.user.edge_related_profiles.edges.slice(0, 3).forEach((edge, i) => {
                const profile = edge.node;
                console.log(`     ${i + 1}. @${profile.username} - ${profile.full_name} ${profile.is_verified ? '✓' : ''}`);
            });
        }
        
        // Save response
        await fs.writeFile(
            path.join(OUTPUT_DIR, `scrapecreators-${username}-quick.json`),
            JSON.stringify(data, null, 2)
        );
        
        return { success: true, relatedCount, responseTime: endTime - startTime };
        
    } catch (error) {
        console.error(`❌ ScrapeCreators failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testApify(username) {
    console.log('🔍 Testing Apify Instagram Profile Scraper...');
    
    const startTime = Date.now();
    
    try {
        const { ApifyClient } = require('apify-client');
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        const input = {
            usernames: [username],
            resultsLimit: 1,
            addParentData: true
        };

        const run = await client
            .actor(process.env.INSTAGRAM_SCRAPER_ACTOR_ID || 'dSCLg0C3YEZ83HzYX')
            .start(input);

        console.log(`   Run ID: ${run.id}`);
        console.log('   Waiting for completion...');
        
        await client.run(run.id).waitForFinish();
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        const endTime = Date.now();

        if (items.length === 0) {
            throw new Error('No profile data returned');
        }

        const profileData = items[0];
        const relatedCount = profileData.relatedProfiles?.length || 0;
        
        console.log('✅ Apify Results:');
        console.log(`   Response Time: ${endTime - startTime}ms`);
        console.log(`   Main Profile: @${profileData.username} (${profileData.fullName})`);
        console.log(`   Followers: ${profileData.followersCount?.toLocaleString() || 'N/A'}`);
        console.log(`   Biography: ${(profileData.biography || 'No bio').substring(0, 60)}...`);
        console.log(`   Business Email: ${profileData.businessEmail || 'None'}`);
        console.log(`   External URL: ${profileData.externalUrl || 'None'}`);
        console.log(`   Related Profiles: ${relatedCount}`);
        
        if (relatedCount > 0) {
            console.log('   Sample Related:');
            profileData.relatedProfiles.slice(0, 3).forEach((profile, i) => {
                console.log(`     ${i + 1}. @${profile.username} - ${profile.full_name} ${profile.is_verified ? '✓' : ''}`);
            });
        }
        
        // Save response
        await fs.writeFile(
            path.join(OUTPUT_DIR, `apify-${username}-quick.json`),
            JSON.stringify(profileData, null, 2)
        );
        
        return { 
            success: true, 
            relatedCount, 
            responseTime: endTime - startTime,
            hasRichData: !!(profileData.followersCount || profileData.biography || profileData.businessEmail)
        };
        
    } catch (error) {
        console.error(`❌ Apify failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runQuickTest() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    const results = {};
    
    if (API_TO_TEST === 'scrapecreators' || API_TO_TEST === 'both') {
        console.log('\n📡 Testing ScrapeCreators...');
        results.scrapeCreators = await testScrapeCreators(TEST_USERNAME);
    }
    
    if (API_TO_TEST === 'apify' || API_TO_TEST === 'both') {
        console.log('\n📡 Testing Apify...');
        results.apify = await testApify(TEST_USERNAME);
    }
    
    // Quick comparison
    if (API_TO_TEST === 'both') {
        console.log('\n' + '='.repeat(50));
        console.log('📊 QUICK COMPARISON');
        console.log('='.repeat(50));
        
        const sc = results.scrapeCreators;
        const ap = results.apify;
        
        console.log(`ScrapeCreators: ${sc.success ? 'SUCCESS' : 'FAILED'}`);
        if (sc.success) {
            console.log(`   Related Profiles: ${sc.relatedCount}`);
            console.log(`   Response Time: ${sc.responseTime}ms`);
        }
        
        console.log(`\nApify: ${ap.success ? 'SUCCESS' : 'FAILED'}`);
        if (ap.success) {
            console.log(`   Related Profiles: ${ap.relatedCount}`);
            console.log(`   Response Time: ${ap.responseTime}ms`);
            console.log(`   Rich Data Available: ${ap.hasRichData ? 'YES' : 'NO'}`);
        }
        
        // Recommendation
        if (sc.success && ap.success) {
            if (ap.relatedCount > sc.relatedCount) {
                console.log('\n🏆 Apify found more related profiles');
            } else if (sc.relatedCount > ap.relatedCount) {
                console.log('\n🏆 ScrapeCreators found more related profiles');
            } else if (ap.relatedCount === sc.relatedCount && ap.relatedCount > 0) {
                console.log('\n🤝 Both found same number of profiles, but Apify has richer data');
            }
        }
    }
    
    console.log(`\n📁 Response files saved to: ${OUTPUT_DIR}/`);
}

// Usage instructions
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage:');
    console.log('  node quick-test-instagram-apis.js [username] [api]');
    console.log('');
    console.log('Arguments:');
    console.log('  username    Instagram username to test (default: redbull)');
    console.log('  api         Which API to test: scrapecreators, apify, or both (default: both)');
    console.log('');
    console.log('Examples:');
    console.log('  node quick-test-instagram-apis.js');
    console.log('  node quick-test-instagram-apis.js nike');
    console.log('  node quick-test-instagram-apis.js cocacola apify');
    console.log('  node quick-test-instagram-apis.js redbull scrapecreators');
    process.exit(0);
}

runQuickTest()
    .then(() => {
        console.log('\n✨ Quick test completed!');
    })
    .catch(error => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    }); 