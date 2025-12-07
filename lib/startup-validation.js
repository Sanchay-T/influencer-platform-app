import { structuredConsole } from '@/lib/logging/console-proxy';

/**
 * Startup Validation - Prevents environment mismatches
 * Import this in your main app file to auto-validate on startup
 */

import { cleanTestSubscriptionsInProduction } from './migrations/clean-test-subscriptions.js';
import { StripeEnvironmentValidator } from './billing/stripe-env-validator.js';

export function validateEnvironmentOnStartup() {
	const verbose =
		process.env.STARTUP_VALIDATION_VERBOSE === 'true' || process.env.NODE_ENV === 'production';
	const log = verbose ? structuredConsole.log : () => {};
	const warn = verbose ? structuredConsole.warn : () => {};

	log('[STARTUP-VALIDATION] Running environment validation...');

	try {
		const isProductionDeployment =
			process.env.VERCEL_ENV === 'production' ||
			(process.env.NODE_ENV === 'production' && process.env.CI === 'true');

		// Validate Stripe configuration
		const stripeValidation = StripeEnvironmentValidator.validate();

		if (!stripeValidation.isValid) {
			structuredConsole.error('[STARTUP-VALIDATION][ERROR] Environment validation failed');

			// In production, prevent app from starting
			if (isProductionDeployment) {
				structuredConsole.error(
					'[STARTUP-VALIDATION][ABORT] Stopping production deployment due to configuration errors'
				);
				throw new Error('Invalid environment configuration - cannot start in production');
			}
		}

		// Log current configuration for debugging
		log('[STARTUP-VALIDATION] Current Configuration:');
		log('   NODE_ENV:', process.env.NODE_ENV);
		log('   VERCEL_ENV:', process.env.VERCEL_ENV || 'not set');
		log('   Stripe Mode:', stripeValidation.environment.secretKeyType.toUpperCase());
		log('   Dev Mode:', process.env.NEXT_PUBLIC_DEV_MODE || 'false');

		log('[STARTUP-VALIDATION][OK] Environment validation complete');

		// Run database cleanup if in production
		if (isProductionDeployment) {
			cleanTestSubscriptionsInProduction().catch((error) => {
				warn('[STARTUP-VALIDATION][WARN] Database cleanup warning:', error.message);
			});
		}

		return stripeValidation;
	} catch (error) {
		structuredConsole.error(
			'[STARTUP-VALIDATION][CRITICAL] Critical validation error:',
			error.message
		);

		if (isProductionDeployment) {
			process.exit(1);
		}

		throw error;
	}
}

// Auto-run validation on import (server-side only)
if (typeof window === 'undefined') {
	validateEnvironmentOnStartup();
}
