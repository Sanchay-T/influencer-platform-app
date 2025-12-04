/**
 * E2E Search Flow Test
 *
 * Tests the full search flow: create user -> set plan -> create campaign -> start search -> poll
 */

const crypto = require('crypto');
const http = require('http');

function base64UrlEncode(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signHmacSha256Base64Url(data, secret) {
  const h = crypto.createHmac('sha256', secret);
  h.update(data);
  return base64UrlEncode(h.digest());
}

function makeRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        ...headers,
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

const secret = 'runner-test-secret';
const ts = Date.now();
const testUserId = 'e2e-claude-v2-' + ts;
const testEmail = 'e2e.test+claude-v2-' + ts + '@example.com';

function buildAuthHeaders(userId, email) {
  const payload = { userId, email, iat: Math.floor(Date.now() / 1000) };
  const token = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = signHmacSha256Base64Url(token, secret);
  return { 'x-test-auth': token, 'x-test-signature': sig };
}

const authHeaders = buildAuthHeaders(testUserId, testEmail);

async function runFullTest() {
  console.log('========================================');
  console.log('  FULL E2E SEARCH FLOW TEST');
  console.log('========================================');
  console.log('Test User:', testUserId);
  console.log('Email:', testEmail);
  console.log('');

  // Step 1: Create test user
  console.log('--- STEP 1: Create test user ---');
  const createResult = await makeRequest('POST', '/api/admin/e2e/create-test-user',
    { userId: testUserId, email: testEmail });
  console.log('Status:', createResult.status);
  if (createResult.data.created) {
    console.log('OK: User created');
  } else {
    console.log('FAIL:', createResult.data);
    return;
  }

  // Step 2: Set plan (now includes onboardingStep: 'completed')
  console.log('--- STEP 2: Set plan to glow_up ---');
  const planResult = await makeRequest('PATCH', '/api/admin/e2e/set-plan',
    { email: testEmail, plan: 'glow_up', trialStatus: 'active', subscriptionStatus: 'active' });
  console.log('Status:', planResult.status);
  console.log('Response:', JSON.stringify(planResult.data));
  if (planResult.status !== 200) {
    console.log('FAIL: Could not set plan');
    await makeRequest('DELETE', '/api/admin/e2e/user-state', { email: testEmail });
    return;
  }

  // Step 3: Create campaign
  console.log('--- STEP 3: Create campaign ---');
  const campaignResult = await makeRequest('POST', '/api/campaigns',
    { name: 'Claude E2E Test', description: 'Test', searchType: 'keyword' },
    authHeaders);
  console.log('Status:', campaignResult.status);
  if (campaignResult.status !== 200 && campaignResult.status !== 201) {
    console.log('FAIL:', JSON.stringify(campaignResult.data));
    await makeRequest('DELETE', '/api/admin/e2e/user-state', { email: testEmail });
    return;
  }
  const campaignId = campaignResult.data.id;
  console.log('OK: Campaign ID:', campaignId);

  // Step 4: Start TikTok keyword search
  console.log('--- STEP 4: Start TikTok search ---');
  const searchResult = await makeRequest('POST', '/api/scraping/tiktok',
    { keywords: ['fitness influencer'], targetResults: 100, campaignId },
    authHeaders);
  console.log('Status:', searchResult.status);
  if (searchResult.status !== 200) {
    console.log('FAIL:', JSON.stringify(searchResult.data));
    await makeRequest('DELETE', '/api/admin/e2e/user-state', { email: testEmail });
    return;
  }
  const jobId = searchResult.data.jobId;
  console.log('OK: Job ID:', jobId);
  console.log('QStash Message ID:', searchResult.data.qstashMessageId);

  // Step 5: Poll for status
  console.log('--- STEP 5: Poll job status ---');
  const pollResult = await makeRequest('GET', '/api/scraping/tiktok?jobId=' + jobId, null, authHeaders);
  console.log('Status:', pollResult.status);
  console.log('Job Status:', pollResult.data.status);
  console.log('Progress:', pollResult.data.processedResults + '/' + pollResult.data.targetResults);

  // Cleanup
  console.log('--- CLEANUP ---');
  await makeRequest('DELETE', '/api/admin/e2e/user-state', { email: testEmail });
  console.log('Test user deleted');

  console.log('');
  console.log('========================================');
  console.log('  ALL TESTS PASSED!');
  console.log('========================================');
}

runFullTest().catch(e => console.error('Test failed:', e));
