#!/usr/bin/env node

/**
 * Stripe Environment Checker and Fixer
 */

require('dotenv').config({ path: '.env.local' });

function checkStripeEnvironment() {
  console.log('🔍 STRIPE ENVIRONMENT CHECK');
  console.log('━'.repeat(50));
  
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  
  console.log('🔑 Secret Key:', secretKey.substring(0, 15) + '...');
  console.log('🔑 Publishable Key:', publishableKey.substring(0, 15) + '...');
  
  // Check if keys are test or live
  const isSecretTest = secretKey.startsWith('sk_test_');
  const isPublishableTest = publishableKey.startsWith('pk_test_');
  
  console.log('\n📊 KEY ANALYSIS:');
  console.log(`Secret Key: ${isSecretTest ? '✅ TEST' : '❌ LIVE'}`);
  console.log(`Publishable Key: ${isPublishableTest ? '✅ TEST' : '❌ LIVE'}`);
  
  if (isSecretTest && isPublishableTest) {
    console.log('\n✅ GOOD: Both keys are in TEST mode');
    console.log('💡 The error might be coming from:');
    console.log('   1. Vercel environment variables using live keys');
    console.log('   2. Another .env file overriding these values');
    console.log('   3. Process environment variables');
  } else {
    console.log('\n❌ PROBLEM: Key mismatch detected');
    console.log('🔧 SOLUTION: Update keys to match the environment you want');
  }
  
  // Check for subscription ID pattern
  const subId = 'sub_1RmIl6IgBf4indow6nna9OSp';
  console.log('\n🎫 SUBSCRIPTION ANALYSIS:');
  console.log(`Subscription ID: ${subId}`);
  console.log('💡 This subscription exists in TEST mode only');
  
  console.log('\n🛠️  IMMEDIATE FIXES:');
  console.log('1. Ensure all Stripe keys are TEST keys');
  console.log('2. Check Vercel environment variables');
  console.log('3. Restart your development server');
  console.log('4. Clear browser cache/cookies');
}

// Check specific environment variables
function checkAllEnvSources() {
  console.log('\n🔍 ALL STRIPE ENVIRONMENT SOURCES:');
  console.log('━'.repeat(50));
  
  // Check process.env
  console.log('📄 From process.env:');
  console.log('  STRIPE_SECRET_KEY:', (process.env.STRIPE_SECRET_KEY || 'not set').substring(0, 15) + '...');
  console.log('  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'not set').substring(0, 15) + '...');
  
  // Check if running in development
  console.log('\n🌍 Environment Context:');
  console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('  VERCEL_ENV:', process.env.VERCEL_ENV || 'not set');
  console.log('  NEXT_PUBLIC_DEV_MODE:', process.env.NEXT_PUBLIC_DEV_MODE || 'not set');
}

checkStripeEnvironment();
checkAllEnvSources();