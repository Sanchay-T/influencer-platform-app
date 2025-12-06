import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * Stripe Environment Validator
 * Prevents test/live key mismatches permanently
 */

export class StripeEnvironmentValidator {
  static validate() {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const vercelEnv = process.env.VERCEL_ENV || '';
    const logLevel = (process.env.STRIPE_VALIDATOR_LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'error')).toLowerCase();
    const logDebug = logLevel === 'debug';
    const logInfo = logDebug || logLevel === 'info';
    const logWarn = logInfo || logLevel === 'warn';
    
    // Determine if we're in true production (not preview/development)
    const isProduction = vercelEnv === 'production'; // Only true production, not preview
    
    // Check key types
    const isSecretTest = secretKey.startsWith('sk_test_');
    const isSecretLive = secretKey.startsWith('sk_live_');
    const isPublishableTest = publishableKey.startsWith('pk_test_');
    const isPublishableLive = publishableKey.startsWith('pk_live_');
    
    const errors = [];
    const warnings = [];
    
    // Environment detection
    if (logInfo) {
      structuredConsole.log('[STRIPE-VALIDATOR] Environment Detection:', {
        NODE_ENV: nodeEnv,
        VERCEL_ENV: vercelEnv,
        isProduction,
        secretKeyType: isSecretTest ? 'TEST' : isSecretLive ? 'LIVE' : 'UNKNOWN',
        publishableKeyType: isPublishableTest ? 'TEST' : isPublishableLive ? 'LIVE' : 'UNKNOWN'
      });
    }
    
    // Rule 1: Keys must match each other
    if ((isSecretTest && !isPublishableTest) || (isSecretLive && !isPublishableLive)) {
      errors.push('STRIPE KEY MISMATCH: Secret and publishable keys are from different environments');
    }
    
    // Rule 2: True production environment should use live keys (preview/development can use test keys)
    if (isProduction && (isSecretTest || isPublishableTest)) {
      errors.push('PRODUCTION ENVIRONMENT USING TEST KEYS: This will cause subscription access errors');
    }
    
    // Rule 3: Development environment should use test keys
    if (!isProduction && (isSecretLive || isPublishableLive)) {
      warnings.push('[STRIPE-VALIDATOR][WARN]  DEVELOPMENT ENVIRONMENT USING LIVE KEYS: This will charge real money');
    }
    
    // Rule 4: Keys must be valid format
    if (!isSecretTest && !isSecretLive) {
      errors.push('[STRIPE-VALIDATOR][FAIL] INVALID SECRET KEY: Must start with sk_test_ or sk_live_');
    }
    
    if (!isPublishableTest && !isPublishableLive) {
      errors.push('[STRIPE-VALIDATOR][FAIL] INVALID PUBLISHABLE KEY: Must start with pk_test_ or pk_live_');
    }
    
    // Report results
    if (errors.length > 0) {
      structuredConsole.error('[STRIPE-VALIDATOR][CRITICAL] CRITICAL ERRORS:');
      errors.forEach(error => structuredConsole.error('   ' + error));
      structuredConsole.error('');
      structuredConsole.error('[STRIPE-VALIDATOR][ACTION] [STRIPE-VALIDATOR] TO FIX:');
      structuredConsole.error('   1. Check your environment files (.env.local vs .env.production)');
      structuredConsole.error('   2. Verify Vercel environment variables');
      structuredConsole.error('   3. Ensure NODE_ENV matches your deployment environment');
      structuredConsole.error('');
      
      // In production, throw error to prevent app from starting
      if (isProduction) {
        throw new Error('STRIPE ENVIRONMENT VALIDATION FAILED - Cannot start app with invalid Stripe configuration');
      }
    }
    
    if (warnings.length > 0 && logWarn) {
      structuredConsole.warn('[STRIPE-VALIDATOR] WARNINGS:');
      warnings.forEach(warning => structuredConsole.warn('   ' + warning));
    }
    
    if (errors.length === 0 && warnings.length === 0 && logInfo) {
      const envType = vercelEnv === 'production' ? 'production' : vercelEnv === 'preview' ? 'preview/staging' : 'development';
      structuredConsole.log(`[STRIPE-VALIDATOR][OK] Stripe environment validation passed for ${envType} environment`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      environment: {
        isProduction,
        secretKeyType: isSecretTest ? 'test' : 'live',
        publishableKeyType: isPublishableTest ? 'test' : 'live'
      }
    };
  }
  
  /**
   * Automatically prevent database operations with wrong environment
   */
  static async validateSubscriptionAccess(subscriptionId) {
    if (!subscriptionId) return true;
    
    const validation = this.validate();
    
    // Check if subscription ID pattern matches current environment
    const isTestSub = subscriptionId.includes('test') || subscriptionId.startsWith('sub_1Rm');
    const isLiveEnvironment = validation.environment.secretKeyType === 'live';
    
    if (isTestSub && isLiveEnvironment) {
      structuredConsole.error('[STRIPE-VALIDATOR][CRITICAL] SUBSCRIPTION MISMATCH DETECTED:');
      structuredConsole.error(`   Subscription: ${subscriptionId} (TEST)`);
      structuredConsole.error(`   Environment: ${validation.environment.secretKeyType.toUpperCase()}`);
      structuredConsole.error('   Action: Blocking operation to prevent error');
      
      // Auto-clean the test subscription from database
      structuredConsole.log('[STRIPE-VALIDATOR] CLEANUP Auto-cleaning test subscription...');
      await this.autoCleanTestSubscription(subscriptionId);
      
      return false;
    }
    
    return true;
  }
  
  /**
   * Auto-clean test subscriptions when detected
   */
  static async autoCleanTestSubscription(subscriptionId) {
    try {
      // This would require database access - implement based on your DB setup
      structuredConsole.log(`[AUTO-CLEAN] Would clean subscription: ${subscriptionId}`);
      structuredConsole.log('[AUTO-CLEAN] Consider implementing automatic cleanup here');
      
      // Example implementation:
      // const { db } = await import('../db');
      // const { userProfiles } = await import('../db/schema');
      // const { eq } = await import('drizzle-orm');
      // 
      // await db.update(userProfiles)
      //   .set({
      //     stripe_subscription_id: null,
      //     stripe_customer_id: null,
      //     subscription_status: null
      //   })
      //   .where(eq(userProfiles.stripe_subscription_id, subscriptionId));
      
    } catch (error) {
      structuredConsole.error('[STRIPE-VALIDATOR][FAIL] [AUTO-CLEAN] Failed to clean subscription:', error.message);
    }
  }
}

// Auto-validate on import (runs when server starts)
if (typeof window === 'undefined') { // Server-side only
  try {
    StripeEnvironmentValidator.validate();
  } catch (error) {
    structuredConsole.error('STRIPE ENVIRONMENT VALIDATION FAILED:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Prevent production deployment with wrong config
    }
  }
}
