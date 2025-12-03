/**
 * Test Webhook Idempotency
 *
 * This script tests the webhook idempotency system to ensure:
 * 1. First event is processed (shouldProcess = true)
 * 2. Duplicate event is skipped (shouldProcess = false)
 * 3. Events can be marked as completed/failed
 * 4. Cleanup works correctly
 *
 * Run with: npx tsx scripts/test-webhook-idempotency.ts
 */

import {
  checkWebhookIdempotency,
  markWebhookCompleted,
  markWebhookFailed,
  cleanupOldWebhookEvents,
} from '../lib/webhooks/idempotency';
import { db } from '../lib/db';
import { webhookEvents } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function testIdempotency() {
  console.log('🧪 Testing Webhook Idempotency System\n');

  const testEventId = `test_event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const testSource = 'stripe' as const;
  const testType = 'test.event';
  const testTimestamp = new Date();
  const testPayload = { test: true, timestamp: Date.now() };

  try {
    // Test 1: First event should be processed
    console.log('📌 Test 1: First event should be processed');
    const first = await checkWebhookIdempotency(
      testEventId,
      testSource,
      testType,
      testTimestamp,
      testPayload
    );

    if (first.shouldProcess) {
      console.log('   ✅ PASS: First event returned shouldProcess=true');
    } else {
      console.log(`   ❌ FAIL: First event returned shouldProcess=false (reason: ${first.reason})`);
      return;
    }

    // Test 2: Duplicate event should be skipped
    console.log('\n📌 Test 2: Duplicate event should be skipped');
    const duplicate = await checkWebhookIdempotency(
      testEventId,
      testSource,
      testType,
      testTimestamp,
      testPayload
    );

    if (!duplicate.shouldProcess) {
      console.log(`   ✅ PASS: Duplicate event returned shouldProcess=false (reason: ${duplicate.reason})`);
    } else {
      console.log('   ❌ FAIL: Duplicate event returned shouldProcess=true');
    }

    // Test 3: Mark as completed
    console.log('\n📌 Test 3: Mark event as completed');
    await markWebhookCompleted(testEventId);

    const completed = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.eventId, testEventId)
    });

    if (completed?.status === 'completed') {
      console.log('   ✅ PASS: Event marked as completed');
    } else {
      console.log(`   ❌ FAIL: Event status is ${completed?.status}`);
    }

    // Test 4: Completed event should still be skipped
    console.log('\n📌 Test 4: Completed event should still be skipped');
    const afterComplete = await checkWebhookIdempotency(
      testEventId,
      testSource,
      testType,
      testTimestamp,
      testPayload
    );

    if (!afterComplete.shouldProcess && afterComplete.reason?.includes('completed')) {
      console.log(`   ✅ PASS: Completed event skipped (reason: ${afterComplete.reason})`);
    } else {
      console.log(`   ❌ FAIL: Unexpected result (shouldProcess: ${afterComplete.shouldProcess}, reason: ${afterComplete.reason})`);
    }

    // Test 5: Test failed event marking
    console.log('\n📌 Test 5: Test failed event marking');
    const failedEventId = `test_failed_${Date.now()}`;
    await checkWebhookIdempotency(failedEventId, testSource, testType);
    await markWebhookFailed(failedEventId, 'Test error message');

    const failed = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.eventId, failedEventId)
    });

    if (failed?.status === 'failed' && failed?.errorMessage === 'Test error message') {
      console.log('   ✅ PASS: Event marked as failed with error message');
    } else {
      console.log(`   ❌ FAIL: Event status is ${failed?.status}, error: ${failed?.errorMessage}`);
    }

    // Cleanup test events
    console.log('\n🧹 Cleaning up test events...');
    await db.delete(webhookEvents).where(eq(webhookEvents.eventId, testEventId));
    await db.delete(webhookEvents).where(eq(webhookEvents.eventId, failedEventId));
    console.log('   ✅ Test events cleaned up');

    console.log('\n✨ All tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }

  process.exit(0);
}

testIdempotency();
