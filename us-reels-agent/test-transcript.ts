import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SC_API_KEY = process.env.SC_API_KEY;

if (!SC_API_KEY) {
    console.error('❌ SC_API_KEY not found in .env file');
    process.exit(1);
}

/**
 * Test the ScrapeCreators transcript endpoint with a single URL
 */
async function testTranscriptEndpoint(url: string) {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  🧪 Testing ScrapeCreators Transcript API');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`📍 Endpoint: GET /v2/instagram/media/transcript`);
    console.log(`🔗 URL: ${url}`);
    console.log(`🔑 API Key: ${SC_API_KEY.substring(0, 10)}...${SC_API_KEY.slice(-4)}`);
    console.log('════════════════════════════════════════════════════════════════\n');

    const startTime = Date.now();

    try {
        console.log('⏳ Making request (this may take 10-30 seconds)...\n');

        const response = await axios.get('https://api.scrapecreators.com/v2/instagram/media/transcript', {
            params: { url },
            headers: {
                'x-api-key': SC_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 second timeout
        });

        const duration = Date.now() - startTime;

        console.log('════════════════════════════════════════════════════════════════');
        console.log('  ✅ SUCCESS');
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        console.log(`\n📦 Response Data:\n`);
        console.log(JSON.stringify(response.data, null, 2));

        // Analyze the response
        console.log('\n════════════════════════════════════════════════════════════════');
        console.log('  📋 Analysis');
        console.log('════════════════════════════════════════════════════════════════');

        if (response.data.success) {
            console.log('✅ API returned success: true');
        } else {
            console.log('⚠️  API returned success: false');
        }

        const transcripts = response.data.transcripts || [];
        console.log(`📝 Transcripts count: ${transcripts.length}`);

        transcripts.forEach((t: any, i: number) => {
            // API returns 'text' field, not 'transcript'
            const text = t.text || t.transcript; // Support both for backwards compatibility
            const hasText = text && text.trim().length > 0;
            console.log(`\n  Transcript #${i + 1}:`);
            console.log(`    • ID: ${t.id || 'N/A'}`);
            console.log(`    • Shortcode: ${t.shortcode || 'N/A'}`);
            console.log(`    • Has text: ${hasText ? '✅' : '❌'}`);
            if (hasText) {
                const preview = text.substring(0, 100);
                console.log(`    • Preview: "${preview}${text.length > 100 ? '...' : ''}"`);
                console.log(`    • Length: ${text.length} characters`);
            } else {
                console.log(`    • Value: ${text === null ? 'null' : '(empty string)'}`);
            }
        });

        if (transcripts.length === 0) {
            console.log('\n⚠️  WARNING: No transcripts in response');
        } else if (transcripts.every((t: any) => {
            const text = t.text || t.transcript;
            return !text || text.trim().length === 0;
        })) {
            console.log('\n⚠️  WARNING: All transcripts are empty/null (video likely has no speech)');
        }

        return response.data;

    } catch (error: any) {
        const duration = Date.now() - startTime;

        console.log('════════════════════════════════════════════════════════════════');
        console.log('  ❌ ERROR');
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);

        if (error.response) {
            // Server responded with error status
            console.log(`📊 Status: ${error.response.status} ${error.response.statusText}`);
            console.log(`\n📦 Error Response:\n`);
            console.log(JSON.stringify(error.response.data, null, 2));

            if (error.response.status === 401) {
                console.log('\n🔑 Authentication Error: Invalid API key');
            } else if (error.response.status === 429) {
                console.log('\n⏸️  Rate Limit: Too many requests');
            } else if (error.response.status === 404) {
                console.log('\n🔍 Not Found: URL might be invalid or post deleted');
            }
        } else if (error.request) {
            // Request made but no response
            console.log('📡 No response received from server');
            console.log('Possible causes:');
            console.log('  • Network connectivity issue');
            console.log('  • API endpoint is down');
            console.log('  • Request timed out');
        } else {
            // Error setting up request
            console.log('⚙️  Request setup error:', error.message);
        }

        console.log('\n🔍 Full Error Details:');
        console.log(error);

        throw error;
    }
}

/**
 * Test multiple URLs to identify patterns
 */
async function testMultipleUrls(urls: string[]) {
    console.log('\n🔬 Testing multiple URLs to identify patterns...\n');

    const results = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  Test ${i + 1}/${urls.length}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        try {
            const result = await testTranscriptEndpoint(url);
            results.push({ url, success: true, data: result });
        } catch (error) {
            results.push({ url, success: false, error: error });
        }

        // Wait 2 seconds between requests to avoid rate limiting
        if (i < urls.length - 1) {
            console.log('\n⏸️  Waiting 2 seconds before next request...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Summary
    console.log('\n\n════════════════════════════════════════════════════════════════');
    console.log('  📊 SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const withTranscripts = results.filter(r =>
        r.success &&
        r.data?.transcripts?.some((t: any) => {
            const text = t.text || t.transcript;
            return text && text.trim().length > 0;
        })
    ).length;

    console.log(`✅ Successful requests: ${successful}/${urls.length}`);
    console.log(`❌ Failed requests: ${failed}/${urls.length}`);
    console.log(`📝 URLs with actual transcripts: ${withTranscripts}/${urls.length}`);

    if (withTranscripts === 0 && successful > 0) {
        console.log('\n⚠️  DIAGNOSIS: API is working but returning empty transcripts');
        console.log('   Possible causes:');
        console.log('   • These specific reels have no spoken audio');
        console.log('   • Reels are music-only or silent videos');
        console.log('   • AI transcription is failing to detect speech');
    }

    return results;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        // Test with a known good URL from the agent run
        console.log('ℹ️  No URL provided, testing with URLs from the agent run...\n');

        const testUrls = [
            'https://www.instagram.com/reel/DPWEIyvifuh',
            'https://www.instagram.com/reel/DOZxR2fE5cu',
            'https://www.instagram.com/reel/DOcyTVxk9hi',
            'https://www.instagram.com/reel/DPkF5BRAZRy',
            'https://www.instagram.com/reel/DPeMz4aEcb6'
        ];

        await testMultipleUrls(testUrls);
    } else if (args[0] === '--batch') {
        // Test multiple URLs
        const urls = args.slice(1);
        if (urls.length === 0) {
            console.error('❌ --batch flag requires URLs as arguments');
            console.error('Usage: npm run test:transcript -- --batch URL1 URL2 URL3');
            process.exit(1);
        }
        await testMultipleUrls(urls);
    } else {
        // Test single URL
        const url = args[0];
        await testTranscriptEndpoint(url);
    }
}

// Run main and handle errors
main()
    .then(() => {
        console.log('\n✅ Test completed successfully\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed with error\n');
        process.exit(1);
    });
