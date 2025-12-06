/**
 * Test Clerk Webhook Locally
 * This simulates what Clerk sends when a user is created
 */

const crypto = require('crypto');

// Webhook secret from .env.development
const WEBHOOK_SECRET = 'whsec_YMNcnQHewI9qcRJ3X8rPrV90waCHukMN';
const ENDPOINT_URL = 'http://localhost:3001/api/webhooks/clerk';

// Mock user.created event
const mockEvent = {
  data: {
    id: 'user_test_' + Date.now(),
    email_addresses: [
      {
        email_address: `test_${Date.now()}@example.com`,
        id: 'email_test',
        object: 'email_address'
      }
    ],
    first_name: 'Test',
    last_name: 'User',
    created_at: Date.now(),
    updated_at: Date.now()
  },
  object: 'event',
  type: 'user.created'
};

// Create Svix signature (simplified version - real Svix is more complex)
const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify(mockEvent);
const msgId = 'msg_test_' + Date.now();

// Svix signature format: timestamp.msgId.payload
const signedContent = `${timestamp}.${msgId}.${payload}`;
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET.replace('whsec_', ''))
  .update(signedContent)
  .digest('base64');

console.log('🧪 [WEBHOOK-TEST] Testing Clerk webhook endpoint...\n');
console.log('📋 Mock Event:');
console.log(JSON.stringify(mockEvent, null, 2));
console.log('\n🔐 Signature Info:');
console.log('  Timestamp:', timestamp);
console.log('  Message ID:', msgId);
console.log('  Signature:', signature);
console.log('\n📡 Sending request to:', ENDPOINT_URL);
console.log('\n⏳ Waiting for response...\n');

// Make the request
fetch(ENDPOINT_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'svix-id': msgId,
    'svix-timestamp': timestamp.toString(),
    'svix-signature': `v1,${signature}`
  },
  body: payload
})
  .then(async (response) => {
    const status = response.status;
    const data = await response.json().catch(() => ({}));

    console.log('📥 Response Received:');
    console.log('  Status:', status);
    console.log('  Body:', JSON.stringify(data, null, 2));

    if (status === 200 && data.success) {
      console.log('\n✅ [SUCCESS] Webhook processed successfully!');
      console.log('\n🔍 Next steps:');
      console.log('  1. Check server logs for: ✅ [CLERK-WEBHOOK] User profile created');
      console.log('  2. Verify user in database with:');
      console.log('     SELECT * FROM users WHERE user_id = \'' + mockEvent.data.id + '\';');
    } else {
      console.log('\n❌ [FAILED] Webhook processing failed');
      console.log('Check server logs for detailed error information');
    }
  })
  .catch((error) => {
    console.error('❌ [ERROR] Request failed:', error.message);
    console.error('\nPossible issues:');
    console.error('  - Server not running on port 3001');
    console.error('  - Network connectivity issues');
    console.error('  - Endpoint not accessible');
  });
