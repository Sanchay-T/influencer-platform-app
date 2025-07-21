/**
 * Startup Validation - Prevents environment mismatches
 * Import this in your main app file to auto-validate on startup
 */

import { StripeEnvironmentValidator } from './stripe/stripe-env-validator.js';
import { cleanTestSubscriptionsInProduction } from './migrations/clean-test-subscriptions.js';

export function validateEnvironmentOnStartup() {
  console.log('🚀 [STARTUP-VALIDATION] Running environment validation...');
  
  try {
    // Validate Stripe configuration
    const stripeValidation = StripeEnvironmentValidator.validate();
    
    if (!stripeValidation.isValid) {
      console.error('❌ [STARTUP-VALIDATION] Environment validation failed');
      
      // In production, prevent app from starting
      if (process.env.NODE_ENV === 'production') {
        console.error('🛑 [STARTUP-VALIDATION] Stopping production deployment due to configuration errors');
        throw new Error('Invalid environment configuration - cannot start in production');
      }
    }
    
    // Log current configuration for debugging
    console.log('📊 [STARTUP-VALIDATION] Current Configuration:');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   VERCEL_ENV:', process.env.VERCEL_ENV || 'not set');
    console.log('   Stripe Mode:', stripeValidation.environment.secretKeyType.toUpperCase());
    console.log('   Dev Mode:', process.env.NEXT_PUBLIC_DEV_MODE || 'false');
    
    console.log('✅ [STARTUP-VALIDATION] Environment validation complete');
    
    // Run database cleanup if in production
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      cleanTestSubscriptionsInProduction().catch(error => {
        console.warn('⚠️  [STARTUP-VALIDATION] Database cleanup warning:', error.message);
      });
    }
    
    return stripeValidation;
    
  } catch (error) {
    console.error('🚨 [STARTUP-VALIDATION] Critical validation error:', error.message);
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    
    throw error;
  }
}

// Auto-run validation on import (server-side only)
if (typeof window === 'undefined') {
  validateEnvironmentOnStartup();
}