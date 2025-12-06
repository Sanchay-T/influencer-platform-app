/**
 * Webhook Diagnostic Tool
 * Checks webhook configuration and connectivity
 */

const https = require('https');
const http = require('http');

console.log('🔍 [WEBHOOK-DIAGNOSTIC] Starting webhook configuration check\n');
console.log('=' .repeat(70) + '\n');

// Load environment variables
require('dotenv').config({ path: '.env.development' });

const NGROK_URL = process.env.NEXT_PUBLIC_SITE_URL;
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const LOCAL_PORT = process.env.LOCAL_PORT || 3001;

// Step 1: Check environment variables
console.log('📋 STEP 1: Environment Configuration Check\n');
console.log('  NEXT_PUBLIC_SITE_URL:', NGROK_URL || '❌ NOT SET');
console.log('  CLERK_WEBHOOK_SECRET:', WEBHOOK_SECRET ? '✅ Set' : '❌ NOT SET');
console.log('  LOCAL_PORT:', LOCAL_PORT);
console.log('  Expected webhook URL:', `${NGROK_URL}/api/webhooks/clerk`);
console.log('\n');

if (!NGROK_URL || !WEBHOOK_SECRET) {
  console.log('❌ Missing required environment variables!\n');
  process.exit(1);
}

// Step 2: Check local server
console.log('📋 STEP 2: Local Server Connectivity\n');
console.log(`  Testing: http://localhost:${LOCAL_PORT}/api/webhooks/clerk\n`);

const testLocal = () => {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: LOCAL_PORT,
        path: '/api/webhooks/clerk',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      (res) => {
        console.log(`  ✅ Local server responding (Status: ${res.statusCode})`);
        resolve(true);
      }
    );

    req.on('error', (e) => {
      console.log(`  ❌ Local server NOT responding: ${e.message}`);
      console.log(`     Make sure server is running: npm start`);
      resolve(false);
    });

    req.write('{}');
    req.end();
  });
};

// Step 3: Check ngrok tunnel
console.log('📋 STEP 3: ngrok Tunnel Check\n');
console.log(`  Testing: ${NGROK_URL}/api/webhooks/clerk\n`);

const testNgrok = () => {
  return new Promise((resolve) => {
    const url = new URL(`${NGROK_URL}/api/webhooks/clerk`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, (res) => {
      console.log(`  ✅ ngrok tunnel responding (Status: ${res.statusCode})`);

      if (res.statusCode === 403) {
        console.log(`  ⚠️  Got 403 - ngrok might need browser confirmation`);
        console.log(`     Visit: ${NGROK_URL} in browser and click "Visit Site"`);
      }

      resolve(res.statusCode !== 403);
    });

    req.on('error', (e) => {
      console.log(`  ❌ ngrok tunnel NOT accessible: ${e.message}`);
      console.log(`     Check if ngrok is running: curl http://localhost:4040/api/tunnels`);
      resolve(false);
    });

    req.write('{}');
    req.end();
  });
};

// Step 4: Instructions
const showInstructions = (localOk, ngrokOk) => {
  console.log('\n');
  console.log('=' .repeat(70));
  console.log('\n📝 NEXT STEPS:\n');

  if (!localOk) {
    console.log('1. ❌ Start your development server:');
    console.log('   npm start\n');
  } else {
    console.log('1. ✅ Local server is running\n');
  }

  if (!ngrokOk) {
    console.log('2. ❌ Fix ngrok tunnel:');
    console.log('   - Check ngrok is running: curl http://localhost:4040/api/tunnels');
    console.log('   - Restart ngrok if needed: ngrok http 3001');
    console.log('   - If ngrok URL changed, update:');
    console.log('     • .env.development → NEXT_PUBLIC_SITE_URL');
    console.log('     • Clerk Dashboard → Webhook endpoint URL\n');
  } else {
    console.log('2. ✅ ngrok tunnel is accessible\n');
  }

  console.log('3. 🔐 Verify Clerk Configuration:');
  console.log('   Go to: https://dashboard.clerk.com → Webhooks');
  console.log('   Endpoint should be:', `${NGROK_URL}/api/webhooks/clerk`);
  console.log('   Events enabled: user.created, user.updated, user.deleted');
  console.log('   Signing Secret should match CLERK_WEBHOOK_SECRET in .env\n');

  console.log('4. 🧪 Test by creating a new user in Clerk');
  console.log('   Watch server logs for: ✅ [CLERK-WEBHOOK] User profile created\n');

  if (localOk && ngrokOk) {
    console.log('✅ All connectivity checks passed!');
    console.log('   If webhooks still fail, check the signing secret in Clerk Dashboard');
  }

  console.log('\n' + '=' .repeat(70) + '\n');
};

// Run all tests
(async () => {
  const localOk = await testLocal();
  await new Promise(r => setTimeout(r, 1000)); // Brief pause
  const ngrokOk = await testNgrok();

  showInstructions(localOk, ngrokOk);
})();
