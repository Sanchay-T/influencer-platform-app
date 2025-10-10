#!/usr/bin/env node
/**
 * Isolated test for ScrapeCreators POST API
 * Tests owner_handle extraction to debug why it's empty in session CSV
 */

import axios from 'axios';

const SC_API_KEY = 'SPPv8ILr6ydcwat6NCr9gpp3pZA3';
const SC = axios.create({
    baseURL: 'https://api.scrapecreators.com',
    headers: { 'x-api-key': SC_API_KEY },
    timeout: 30000
});

// Test URLs from the nutritionist session
const TEST_URLS = [
    'https://www.instagram.com/reel/DN286GsWui3',
    'https://www.instagram.com/reel/DPHK54bkVkY',
    'https://www.instagram.com/reel/DPUlyqkEUoU'
];

async function testPostEndpoint(url: string, useTrim: boolean) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${url}`);
    console.log(`Trim parameter: ${useTrim}`);
    console.log('='.repeat(80));

    try {
        const params: any = { url };
        if (useTrim) {
            params.trim = true;
        }

        const { data, status } = await SC.get('/v1/instagram/post', { params });

        console.log(`\n✅ Response Status: ${status}`);

        // Extract key fields
        const media = data?.data?.xdt_shortcode_media;
        const owner = media?.owner;
        const caption = media?.edge_media_to_caption?.edges?.[0]?.node?.text;

        console.log('\n📊 EXTRACTED FIELDS:');
        console.log('  owner.username:', owner?.username || '❌ MISSING');
        console.log('  owner.full_name:', owner?.full_name || '❌ MISSING');
        console.log('  owner.is_verified:', owner?.is_verified ?? '❌ MISSING');
        console.log('  shortcode:', media?.shortcode || '❌ MISSING');
        console.log('  caption (first 100 chars):', caption?.substring(0, 100) || '❌ MISSING');
        console.log('  is_video:', media?.is_video ?? '❌ MISSING');
        console.log('  video_view_count:', media?.video_view_count ?? '❌ MISSING');

        console.log('\n🔍 FULL OWNER OBJECT:');
        console.log(JSON.stringify(owner, null, 2));

        console.log('\n📋 TOP-LEVEL RESPONSE KEYS:');
        console.log('  data keys:', Object.keys(data || {}));
        if (data?.data) {
            console.log('  data.data keys:', Object.keys(data.data || {}));
        }
        if (media) {
            console.log('  media keys (first 20):', Object.keys(media).slice(0, 20).join(', '));
        }

        return {
            success: true,
            username: owner?.username,
            has_owner_data: !!owner
        };

    } catch (error: any) {
        console.error('\n❌ ERROR:');
        console.error('  Message:', error.message);

        if (error.response) {
            console.error('  Status:', error.response.status);
            console.error('  Status Text:', error.response.statusText);
            console.error('  Data:', JSON.stringify(error.response.data, null, 2));

            if (error.response.status === 402) {
                console.error('\n💳 API KEY OUT OF CREDITS - Cannot proceed with test');
            }
        }

        return {
            success: false,
            error: error.message,
            status: error.response?.status
        };
    }
}

async function main() {
    console.log('🧪 SCRAPECREATORS POST API - ISOLATED TEST');
    console.log('Testing owner_handle extraction issue\n');

    const results: any[] = [];

    // Test first URL with trim=true (current approach)
    console.log('\n' + '═'.repeat(80));
    console.log('TEST 1: With trim=true (current implementation)');
    console.log('═'.repeat(80));
    const result1 = await testPostEndpoint(TEST_URLS[0], true);
    results.push({ url: TEST_URLS[0], trim: true, ...result1 });

    // Only continue if API has credits
    if (result1.status === 402) {
        console.log('\n⚠️  API out of credits. Cannot run additional tests.');
        console.log('\n📝 FINDINGS SO FAR:');
        console.log('  - API key needs credits to continue testing');
        console.log('  - Cannot verify owner_handle extraction behavior');
        return;
    }

    // Test same URL without trim parameter
    console.log('\n' + '═'.repeat(80));
    console.log('TEST 2: Without trim parameter');
    console.log('═'.repeat(80));
    const result2 = await testPostEndpoint(TEST_URLS[0], false);
    results.push({ url: TEST_URLS[0], trim: false, ...result2 });

    // Test second URL with trim=true
    console.log('\n' + '═'.repeat(80));
    console.log('TEST 3: Different URL with trim=true');
    console.log('═'.repeat(80));
    const result3 = await testPostEndpoint(TEST_URLS[1], true);
    results.push({ url: TEST_URLS[1], trim: true, ...result3 });

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(80));

    results.forEach((r, i) => {
        console.log(`\nTest ${i + 1}:`);
        console.log(`  URL: ${r.url.substring(0, 50)}...`);
        console.log(`  Trim: ${r.trim}`);
        console.log(`  Success: ${r.success ? '✅' : '❌'}`);
        console.log(`  Username extracted: ${r.username || 'NONE'}`);
        console.log(`  Has owner data: ${r.has_owner_data ? '✅' : '❌'}`);
    });

    console.log('\n' + '═'.repeat(80));
    console.log('🔍 DIAGNOSIS');
    console.log('═'.repeat(80));

    const allHaveOwner = results.every(r => r.has_owner_data);
    const allHaveUsername = results.every(r => r.username);

    if (allHaveOwner && allHaveUsername) {
        console.log('✅ API returns owner data correctly');
        console.log('❓ Issue may be in updatePostData() CSV writer logic');
    } else if (allHaveOwner && !allHaveUsername) {
        console.log('⚠️  Owner object exists but username field is missing');
        console.log('❓ Check API response structure for username location');
    } else {
        console.log('❌ Owner data is missing from API response');
        console.log('❓ May be API limitation or incorrect endpoint usage');
    }
}

main().catch(console.error);
