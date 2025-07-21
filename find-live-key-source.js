#!/usr/bin/env node

/**
 * Find Exact Source of Live Stripe Key Usage
 */

require('dotenv').config({ path: '.env.local' });

function findLiveKeySource() {
  console.log('🔍 FINDING EXACT SOURCE OF LIVE STRIPE KEY');
  console.log('━'.repeat(50));
  
  console.log('🔑 ENVIRONMENT ANALYSIS:');
  
  // Check all possible environment sources
  const sources = {
    'process.env.STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
    'process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    'NODE_ENV': process.env.NODE_ENV,
    'VERCEL_ENV': process.env.VERCEL_ENV,
    'NEXT_PUBLIC_DEV_MODE': process.env.NEXT_PUBLIC_DEV_MODE,
    'USE_REAL_STRIPE': process.env.USE_REAL_STRIPE,
    'NEXT_PUBLIC_USE_REAL_STRIPE': process.env.NEXT_PUBLIC_USE_REAL_STRIPE
  };
  
  for (const [key, value] of Object.entries(sources)) {
    if (value) {
      if (key.includes('STRIPE')) {
        const isLive = value.startsWith('sk_live_') || value.startsWith('pk_live_');
        const isTest = value.startsWith('sk_test_') || value.startsWith('pk_test_');
        console.log(`${key}: ${value.substring(0, 20)}... ${isLive ? '🔴 LIVE' : isTest ? '🧪 TEST' : '❓ UNKNOWN'}`);
      } else {
        console.log(`${key}: ${value}`);
      }
    } else {
      console.log(`${key}: ❌ not set`);
    }
  }
  
  console.log('\n🌍 ENVIRONMENT CONTEXT:');
  console.log(`Running in: ${process.env.NODE_ENV || 'unknown'}`);
  console.log(`Vercel env: ${process.env.VERCEL_ENV || 'not on Vercel'}`);
  console.log(`Dev mode: ${process.env.NEXT_PUBLIC_DEV_MODE || 'false'}`);
  
  console.log('\n🔍 CHECKING STRIPE CONFIGURATION FILES:');
}

// Check where Stripe is initialized in your code
function checkStripeInitialization() {
  console.log('\n📄 STRIPE INITIALIZATION LOCATIONS:');
  console.log('Check these files for Stripe initialization:');
  console.log('1. lib/stripe/stripe-client.ts');
  console.log('2. lib/stripe/stripe-service.ts');
  console.log('3. Any API routes using Stripe');
  console.log('4. Middleware files');
  
  console.log('\n🔍 LOOK FOR THESE PATTERNS:');
  console.log('• require("stripe")(process.env.STRIPE_SECRET_KEY)');
  console.log('• new Stripe(process.env.STRIPE_SECRET_KEY)');
  console.log('• Hardcoded sk_live_ keys');
  console.log('• Environment-specific key selection logic');
}

// Check for different environment files
function checkEnvironmentFiles() {
  console.log('\n📁 ENVIRONMENT FILES TO CHECK:');
  console.log('• .env.local (development) - ✅ checked');
  console.log('• .env.production (production build)');
  console.log('• .env (fallback)');
  console.log('• Vercel environment variables');
  console.log('• Docker environment variables');
  console.log('• System environment variables');
  
  console.log('\n⚡ QUICK COMMANDS TO CHECK:');
  console.log('# Check Vercel environment');
  console.log('npx vercel env ls');
  console.log('');
  console.log('# Check for other .env files');
  console.log('ls -la .env*');
  console.log('');
  console.log('# Check system environment');
  console.log('echo $STRIPE_SECRET_KEY');
}

// Error location analysis
function analyzeErrorLocation() {
  console.log('\n🎯 ERROR LOCATION ANALYSIS:');
  console.log('━'.repeat(50));
  console.log('The error: "live mode key was used to make this request"');
  console.log('');
  console.log('🔍 This happens when:');
  console.log('1. 📱 Frontend uses pk_live_ (publishable key)');
  console.log('2. 🖥️  Backend uses sk_live_ (secret key)');
  console.log('3. 🔄 Mixed environment in same request');
  console.log('');
  console.log('🎯 MOST LIKELY SOURCES:');
  console.log('1. Vercel production environment variables');
  console.log('2. Frontend JavaScript bundle with live publishable key');
  console.log('3. API route using live secret key');
  console.log('4. Environment variable override in deployment');
  
  console.log('\n🛠️  TO FIND THE EXACT SOURCE:');
  console.log('1. Check browser Network tab for Stripe API calls');
  console.log('2. Look for "pk_live_" in frontend bundle');
  console.log('3. Add console.log in Stripe initialization code');
  console.log('4. Check server logs for which key is being used');
}

// Generate debugging code
function generateDebuggingCode() {
  console.log('\n💻 ADD THIS DEBUG CODE TO YOUR STRIPE INITIALIZATION:');
  console.log('━'.repeat(50));
  console.log(`
// Add this to your Stripe client initialization
console.log('🔑 STRIPE KEY DEBUG:', {
  key: process.env.STRIPE_SECRET_KEY?.substring(0, 20) + '...',
  mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'TEST' : 'LIVE',
  env: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL_ENV,
  source: 'stripe-client-initialization'
});

// Add this to any API route using Stripe
console.log('🎯 API ROUTE STRIPE KEY:', {
  hasKey: !!process.env.STRIPE_SECRET_KEY,
  keyType: process.env.STRIPE_SECRET_KEY?.substring(0, 15),
  route: req.url || 'unknown'
});
  `);
}

// Main execution
findLiveKeySource();
checkStripeInitialization();
checkEnvironmentFiles();
analyzeErrorLocation();
generateDebuggingCode();