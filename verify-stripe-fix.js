#!/usr/bin/env node

/**
 * Verify Stripe Configuration Fix
 */

require('dotenv').config({ path: '.env.local' });

async function verifyStripeFix() {
  console.log('🔍 VERIFYING STRIPE CONFIGURATION FIX');
  console.log('━'.repeat(50));
  
  try {
    // Test Stripe connection
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    console.log('🔑 Using Stripe key:', process.env.STRIPE_SECRET_KEY.substring(0, 15) + '...');
    
    // Try to list a few customers to test the connection
    const customers = await stripe.customers.list({ limit: 1 });
    
    console.log('✅ Stripe connection successful!');
    console.log('🌍 Environment:', process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST MODE' : 'LIVE MODE');
    console.log('📊 Test response received');
    
    // Check the problematic subscription
    const subId = 'sub_1RmIl6IgBf4indow6nna9OSp';
    try {
      const subscription = await stripe.subscriptions.retrieve(subId);
      console.log(`✅ Subscription ${subId} found in current environment!`);
      console.log('   Status:', subscription.status);
      console.log('   Customer:', subscription.customer);
    } catch (subError) {
      if (subError.code === 'resource_missing') {
        console.log(`⚠️  Subscription ${subId} not found in current environment`);
        console.log('   This means you\'re now in the correct TEST environment!');
        console.log('   The subscription was created in a different environment.');
      } else {
        console.log('❌ Subscription check error:', subError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Stripe connection failed:', error.message);
    
    if (error.message.includes('live mode key was used')) {
      console.log('\n🔧 STILL USING LIVE KEYS:');
      console.log('1. Check Vercel environment variables');
      console.log('2. Restart your development server');
      console.log('3. Clear browser cache');
    }
  }
}

verifyStripeFix().catch(console.error);