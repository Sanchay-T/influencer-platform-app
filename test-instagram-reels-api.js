const https = require('https');
const fs = require('fs');
const path = require('path');

// Test queries to understand different content types
const testQueries = [
    'AirPods',
    'Nike',
    'food',
    'travel',
    'fitness'
];

function testInstagramReelsAPI(query) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            hostname: 'instagram-premium-api-2023.p.rapidapi.com',
            port: null,
            path: `/v2/search/reels?query=${encodeURIComponent(query)}`,
            headers: {
                'x-rapidapi-key': '958382f6a1msh6ee05542f311bb3p1eebeajsne632eef2fa54',
                'x-rapidapi-host': 'instagram-premium-api-2023.p.rapidapi.com'
            }
        };

        console.log(`🔍 [INSTAGRAM-API] Testing query: "${query}"`);
        console.log(`📡 [INSTAGRAM-API] Full URL: https://${options.hostname}${options.path}`);

        const req = https.request(options, function (res) {
            const chunks = [];

            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                const body = Buffer.concat(chunks);
                const bodyString = body.toString();
                
                console.log(`✅ [INSTAGRAM-API] Response received for "${query}"`);
                console.log(`📊 [INSTAGRAM-API] Status: ${res.statusCode}`);
                console.log(`📏 [INSTAGRAM-API] Response size: ${bodyString.length} bytes`);

                try {
                    const jsonResponse = JSON.parse(bodyString);
                    resolve({
                        query: query,
                        statusCode: res.statusCode,
                        data: jsonResponse,
                        rawResponse: bodyString
                    });
                } catch (parseError) {
                    console.error(`❌ [INSTAGRAM-API] JSON parse error for "${query}":`, parseError.message);
                    resolve({
                        query: query,
                        statusCode: res.statusCode,
                        error: 'JSON_PARSE_ERROR',
                        rawResponse: bodyString
                    });
                }
            });
        });

        req.on('error', function (error) {
            console.error(`❌ [INSTAGRAM-API] Request error for "${query}":`, error.message);
            reject(error);
        });

        req.end();
    });
}

async function runTests() {
    console.log('🚀 [INSTAGRAM-API-TEST] Starting Instagram Reels API tests...');
    console.log('🎯 [INSTAGRAM-API-TEST] Test queries:', testQueries.join(', '));
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(__dirname, 'instagram-api-results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir);
        console.log('📁 [INSTAGRAM-API-TEST] Created results directory');
    }

    const allResults = [];

    // Test each query
    for (const query of testQueries) {
        try {
            const result = await testInstagramReelsAPI(query);
            allResults.push(result);

            // Save individual result to file
            const filename = `instagram-reels-${query.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
            const filepath = path.join(resultsDir, filename);
            
            fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
            console.log(`💾 [INSTAGRAM-API-TEST] Saved result for "${query}" to ${filename}`);

            // Add delay between requests to be respectful to the API
            if (testQueries.indexOf(query) < testQueries.length - 1) {
                console.log('⏱️ [INSTAGRAM-API-TEST] Waiting 2 seconds before next request...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error) {
            console.error(`❌ [INSTAGRAM-API-TEST] Failed to test "${query}":`, error.message);
            allResults.push({
                query: query,
                error: error.message,
                statusCode: null
            });
        }
    }

    // Save combined results
    const combinedFilepath = path.join(resultsDir, 'instagram-reels-all-results.json');
    fs.writeFileSync(combinedFilepath, JSON.stringify(allResults, null, 2));
    console.log('💾 [INSTAGRAM-API-TEST] Saved combined results to instagram-reels-all-results.json');

    // Generate summary
    const summary = {
        totalQueries: testQueries.length,
        successfulQueries: allResults.filter(r => r.statusCode === 200).length,
        failedQueries: allResults.filter(r => r.statusCode !== 200 || r.error).length,
        timestamp: new Date().toISOString(),
        queries: testQueries,
        results: allResults.map(r => ({
            query: r.query,
            statusCode: r.statusCode,
            hasData: !!r.data,
            dataType: r.data ? typeof r.data : null,
            error: r.error || null
        }))
    };

    const summaryFilepath = path.join(resultsDir, 'instagram-reels-summary.json');
    fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));
    console.log('📋 [INSTAGRAM-API-TEST] Generated summary in instagram-reels-summary.json');

    console.log('\n🎉 [INSTAGRAM-API-TEST] All tests completed!');
    console.log('📊 [INSTAGRAM-API-TEST] Summary:');
    console.log(`   ✅ Successful: ${summary.successfulQueries}/${summary.totalQueries}`);
    console.log(`   ❌ Failed: ${summary.failedQueries}/${summary.totalQueries}`);
    console.log(`   📁 Results saved in: ${resultsDir}`);

    return allResults;
}

// Run the tests
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ [INSTAGRAM-API-TEST] Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = { testInstagramReelsAPI, runTests };