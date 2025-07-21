#!/usr/bin/env node

/**
 * Check what Stripe environment variable is actually being used
 */

require('dotenv').config({ path: '.env.local' });

console.log('🔍 CHECKING CURRENT STRIPE ENVIRONMENT:');
console.log('━'.repeat(50));

const secretKey = process.env.STRIPE_SECRET_KEY || 'NOT_SET';
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'NOT_SET';

console.log('🔑 Secret Key:', secretKey.substring(0, 15) + '...');
console.log('🔑 Mode:', secretKey.startsWith('sk_test_') ? '🧪 TEST' : '🔴 LIVE');
console.log('🔑 Publishable:', publishableKey.substring(0, 15) + '...');
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('🌍 VERCEL_ENV:', process.env.VERCEL_ENV || 'not set');

console.log('\n🎯 THE PROBLEM:');
if (secretKey.startsWith('sk_live_')) {
  console.log('❌ You are using LIVE Stripe keys');
  console.log('❌ But your database has TEST subscription: sub_1RmIl6IgBf4indow6nna9OSp');
  console.log('❌ Live keys cannot access test subscriptions');
  
  console.log('\n🔧 SOLUTION:');
  console.log('Either:');
  console.log('1. Switch to TEST keys in Vercel:');
  console.log('   STRIPE_SECRET_KEY=sk_test_...');
  console.log('   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...');
  console.log('');
  console.log('OR');
  console.log('');
  console.log('2. Clean the test subscription from database (already done)');
  console.log('   And restart your app');
  
} else if (secretKey.startsWith('sk_test_')) {
  console.log('✅ You are using TEST keys - this should work');
  console.log('🤔 But you\'re still getting the error?');
  console.log('💡 This means Vercel might be overriding your local env');
} else {
  console.log('❓ Invalid or missing Stripe secret key');
}

console.log('\n🚀 TO FIX IN VERCEL:');
console.log('1. Go to https://vercel.com/dashboard');
console.log('2. Select your project');
console.log('3. Go to Settings > Environment Variables');
console.log('4. Check what STRIPE_SECRET_KEY is set to');
console.log('5. Update it to match your intended environment');