/**
 * Trace the EXACT error path from API to Frontend
 *
 * This will show every single step the error takes through the system
 */

console.log('\n🔍 COMPLETE ERROR PATH TRACE\n');
console.log('━'.repeat(80));

const screenshotError = 'Exceeded daily rate limit. {"limit":"1000","remaining":"0","reset":"1761782400"}';

console.log('\n📸 Error from Screenshot:');
console.log(`   "${screenshotError}"\n`);

console.log('━'.repeat(80));
console.log('\n🛤️  POSSIBLE ERROR PATHS\n');

console.log('PATH 1: Normal TikTok Provider Flow');
console.log('━'.repeat(50));
console.log('1. ScrapeCreators API responds with HTTP 429');
console.log('   Response Body: "Exceeded daily rate limit. {...}"');
console.log('');
console.log('2. lib/search-engine/providers/tiktok-keyword.ts:47-49');
console.log('   Code: if (!response.ok) {');
console.log('           const body = await response.text().catch(() => \'\');');
console.log('           throw new Error(`TikTok keyword API error ${response.status}: ${body}`);');
console.log('         }');
console.log('   Result: "TikTok keyword API error 429: Exceeded daily rate limit. {...}"');
console.log('           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ADDS THIS PREFIX');
console.log('');
console.log('3. app/api/qstash/process-search/route.ts:111-124');
console.log('   Code: catch (error: any) {');
console.log('           await service.complete(\'error\', { error: error?.message });');
console.log('         }');
console.log('   Result: Error stored in DB with message from step 2');
console.log('');
console.log('4. app/campaigns/[id]/client-page.tsx:1235');
console.log('   Code: {selectedJob.error || \'default message\'}');
console.log('   Result: Displays error from DB directly');
console.log('');
console.log('✅ Expected Output: "TikTok keyword API error 429: Exceeded daily rate limit. {...}"');
console.log(`❌ Actual Output:   "${screenshotError}"`);
console.log('\n🚨 CONCLUSION: The error did NOT go through PATH 1!');

console.log('\n\n');
console.log('PATH 2: Direct API Error (No Provider Wrapper)');
console.log('━'.repeat(50));
console.log('1. Error comes from somewhere that directly stores API response');
console.log('   WITHOUT going through the tiktok-keyword.ts error wrapper');
console.log('');
console.log('Possible sources:');
console.log('  a) Old legacy provider code (before current implementation)');
console.log('  b) Different TikTok endpoint we haven\'t checked');
console.log('  c) Enrichment API or profile API calls');
console.log('  d) Frontend making direct API calls');

console.log('\n\n');
console.log('PATH 3: Error from Enrichment API');
console.log('━'.repeat(50));
console.log('1. tiktok-keyword.ts calls enrichCreator() at line 57-79');
console.log('   This makes calls to:');
console.log('   - profileEndpoint: https://api.scrapecreators.com/v1/tiktok/profile');
console.log('');
console.log('2. If THAT endpoint returns a rate limit error:');
console.log('   Line 76: catch { }');
console.log('   Result: Error is SWALLOWED (not propagated)');
console.log('');
console.log('✅ This path swallows errors, so it can\'t be the source');

console.log('\n\n━'.repeat(80));
console.log('\n🔍 INVESTIGATION STEPS\n');

console.log('Step 1: Check if there are OTHER TikTok API calls');
console.log('  → Search for: fetch.*scrapecreators.*tiktok');
console.log('  → Search for: SCRAPECREATORS_API_URL');
console.log('');
console.log('Step 2: Check the database for the EXACT job');
console.log('  → Query: SELECT id, error, created_at FROM scraping_jobs');
console.log('           WHERE error LIKE \'%Exceeded daily%\'');
console.log('  → This will show us the EXACT error stored');
console.log('');
console.log('Step 3: Check if there are multiple versions of the provider');
console.log('  → Search for: runTikTok');
console.log('  → Check git history for changes to tiktok-keyword.ts');
console.log('');
console.log('Step 4: Test the ACTUAL error path with a simulated error');
console.log('  → Create a test that forces the API to return 429');
console.log('  → See what error format reaches the frontend');

console.log('\n━'.repeat(80));
console.log('\n🎯 KEY QUESTION\n');

console.log('If the error is NOT from ScrapeCreators API,');
console.log('then WHERE in the codebase is this text generated?');
console.log('');
console.log('Answer: ');
console.log('  ✅ We searched the ENTIRE codebase');
console.log('  ✅ The text "Exceeded daily rate limit" does NOT exist');
console.log('  ✅ The JSON format {"limit","remaining","reset"} does NOT exist');
console.log('  ✅ NO code creates this error format');
console.log('');
console.log('Therefore:');
console.log('  → The error MUST be from an external API');
console.log('  → It MUST be ScrapeCreators (only external API for TikTok)');
console.log('  → BUT it somehow bypassed our error wrapper');

console.log('\n━'.repeat(80));
console.log('\n💡 HYPOTHESIS\n');

console.log('The error might be from:');
console.log('');
console.log('HYPOTHESIS A: Old Job (Most Likely)');
console.log('  - Job was created BEFORE current error handling was implemented');
console.log('  - Or using a different code path that no longer exists');
console.log('  - Error is still cached in database from that time');
console.log('');
console.log('HYPOTHESIS B: Different Endpoint');
console.log('  - The profile endpoint or another ScrapeCreators endpoint');
console.log('  - Those might have different error handling');
console.log('  - Need to check ALL ScrapeCreators API calls');
console.log('');
console.log('HYPOTHESIS C: Concurrent Update');
console.log('  - Job error was set by a different process');
console.log('  - Maybe a webhook or cron job');
console.log('  - That directly sets error field without going through provider');

console.log('\n━'.repeat(80));
console.log('\n📋 NEXT ACTIONS\n');

console.log('1. Search for ALL ScrapeCreators API calls in codebase');
console.log('2. Check if there are other files making TikTok API calls');
console.log('3. Look for any job error update logic outside the provider');
console.log('4. Check git history for when this error format was introduced');
console.log('');
console.log('Let me run these searches now...\n');

console.log('━'.repeat(80) + '\n');
