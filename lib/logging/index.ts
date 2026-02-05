/**
 * Centralized Logging System - Public API
 *
 * This is the main entry point for the logging system. Import from here
 * to access all logging functionality with a clean, consistent interface.
 *
 * @example
 * ```typescript
 * import { logger, log, LogLevel, LogCategory } from '@/lib/logging';
 *
 * // Simple usage
 * logger.info('User logged in', { userId: '123' });
 *
 * // With categories
 * logger.api(LogLevel.INFO, 'API request completed', { endpoint: '/users' });
 *
 * // Performance tracking
 * const timer = logger.startTimer('database-query');
 * // ... perform operation
 * timer.end();
 *
 * // Error handling with Sentry integration
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error('Operation failed', error, { userId, operation: 'riskyOperation' });
 * }
 * ```
 */

import { log, logger } from './logger';
// Import types and functions for internal use
import { LogCategory, LogLevel } from './types';

// Constant exports
export {
	generateRequestId,
	getCategoryIcon,
	getLoggerConfig,
	getMinLogLevel,
	getSentryDSN,
	isSensitiveField,
	shouldSendToSentry,
} from './constants';
// Core exports
export { Logger, log, logger } from './logger';
export { SentryLogger, sentry } from './sentry-logger';
// Type exports
export type {
	DataSanitizer,
	LogContext,
	LogEntry,
	LoggerConfig,
	LogMethod,
	LogQueryOptions,
	LogTransport,
	PerformanceTimer,
	SentryLogContext,
} from './types';
// Enum exports for runtime use (both type and value)
export { LogCategory, LogLevel } from './types';

/**
 * Quick-start logging functions
 * These provide an even simpler interface for common logging patterns
 */

/**
 * Create a category-specific logger instance
 * Returns an object with logging methods pre-configured for a specific category
 */
export function createCategoryLogger(category: LogCategory) {
	return {
		debug: (message: string, context?: import('./types').LogContext) =>
			log.debug(message, context, category),

		info: (message: string, context?: import('./types').LogContext) =>
			log.info(message, context, category),

		warn: (message: string, context?: import('./types').LogContext) =>
			log.warn(message, context, category),

		error: (message: string, error?: Error, context?: import('./types').LogContext) =>
			log.error(message, error, context, category),

		critical: (message: string, error?: Error, context?: import('./types').LogContext) =>
			log.critical(message, error, context, category),
	};
}

/**
 * Pre-configured loggers for common categories
 * Use these for consistent logging across the application
 */
export const apiLogger = createCategoryLogger(LogCategory.API);
export const databaseLogger = createCategoryLogger(LogCategory.DATABASE);
export const authLogger = createCategoryLogger(LogCategory.AUTH);
export const paymentLogger = createCategoryLogger(LogCategory.PAYMENT);
export const scrapingLogger = createCategoryLogger(LogCategory.SCRAPING);
export const campaignLogger = createCategoryLogger(LogCategory.CAMPAIGN);
export const performanceLogger = createCategoryLogger(LogCategory.PERFORMANCE);
export const adminLogger = createCategoryLogger(LogCategory.ADMIN);
export const systemLogger = createCategoryLogger(LogCategory.SYSTEM);

/**
 * Enhanced error handling with automatic Sentry integration
 *
 * @param error - The error to handle
 * @param context - Additional context for debugging
 * @param category - Log category (defaults to SYSTEM)
 * @returns The error (for re-throwing if needed)
 */
export function handleError(
	error: unknown,
	context?: import('./types').LogContext,
	category?: LogCategory
): Error {
	const err = error instanceof Error ? error : new Error(String(error));

	logger.error(`Unhandled error: ${err.message}`, err, context, category || LogCategory.SYSTEM);

	return err;
}

/**
 * Performance monitoring decorator
 * Use this to automatically log execution time for async functions
 *
 * @example
 * ```typescript
 * const timedFunction = withPerformanceLogging(
 *   myAsyncFunction,
 *   'database-query',
 *   LogCategory.DATABASE
 * );
 * ```
 */
export function withPerformanceLogging<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	operationName: string,
	category?: LogCategory
): (...args: T) => Promise<R> {
	return async (...args: T): Promise<R> => {
		return logger.withTiming(operationName, () => fn(...args), undefined, category);
	};
}

/**
 * Request logging middleware helper
 * Creates consistent request/response logging for API routes
 */
export function createRequestLogger(baseContext?: import('./types').LogContext) {
	return {
		logRequest: (method: string, url: string, context?: import('./types').LogContext) => {
			logger.api(LogLevel.INFO, `${method} ${url} - Request received`, {
				...baseContext,
				...context,
				method,
				url,
			});
		},

		logResponse: (
			method: string,
			url: string,
			statusCode: number,
			duration: number,
			context?: import('./types').LogContext
		) => {
			const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
			logger.api(level, `${method} ${url} - Response sent`, {
				...baseContext,
				...context,
				method,
				url,
				statusCode,
				executionTime: duration,
			});
		},

		logError: (
			method: string,
			url: string,
			error: Error,
			context?: import('./types').LogContext
		) => {
			logger.api(LogLevel.ERROR, `${method} ${url} - Request failed`, {
				...baseContext,
				...context,
				method,
				url,
				errorMessage: error.message,
			});
		},
	};
}

/**
 * Business logic logging helpers
 * These provide domain-specific logging for common application events
 */
export const businessLogger = {
	/**
	 * Campaign-related logging
	 */
	campaign: {
		created: (campaignId: string, userId: string, context?: import('./types').LogContext) =>
			campaignLogger.info('Campaign created', { ...context, campaignId, userId }),

		started: (campaignId: string, platform: string, context?: import('./types').LogContext) =>
			campaignLogger.info('Campaign search started', { ...context, campaignId, platform }),

		completed: (
			campaignId: string,
			resultCount: number,
			duration: number,
			context?: import('./types').LogContext
		) =>
			campaignLogger.info('Campaign search completed', {
				...context,
				campaignId,
				resultCount,
				executionTime: duration,
			}),

		failed: (campaignId: string, error: Error, context?: import('./types').LogContext) =>
			campaignLogger.error('Campaign search failed', error, { ...context, campaignId }),
	},

	/**
	 * Payment-related logging
	 */
	payment: {
		started: (
			userId: string,
			amount: number,
			planId: string,
			context?: import('./types').LogContext
		) => paymentLogger.info('Payment initiated', { ...context, userId, amount, planId }),

		succeeded: (
			userId: string,
			amount: number,
			stripeSessionId: string,
			context?: import('./types').LogContext
		) => paymentLogger.info('Payment successful', { ...context, userId, amount, stripeSessionId }),

		failed: (userId: string, error: Error, context?: import('./types').LogContext) =>
			paymentLogger.error('Payment failed', error, { ...context, userId }),

		refunded: (
			userId: string,
			amount: number,
			reason: string,
			context?: import('./types').LogContext
		) => paymentLogger.warn('Payment refunded', { ...context, userId, amount, reason }),
	},

	/**
	 * Authentication-related logging
	 */
	auth: {
		login: (userId: string, context?: import('./types').LogContext) =>
			authLogger.info('User logged in', { ...context, userId }),

		logout: (userId: string, context?: import('./types').LogContext) =>
			authLogger.info('User logged out', { ...context, userId }),

		signup: (userId: string, email: string, context?: import('./types').LogContext) =>
			authLogger.info('User signed up', { ...context, userId, userEmail: email }),

		failed: (email: string, reason: string, context?: import('./types').LogContext) =>
			authLogger.warn('Authentication failed', { ...context, userEmail: email, reason }),
	},

	/**
	 * Scraping operation logging
	 */
	scraping: {
		started: (
			platform: string,
			searchType: string,
			targetCount: number,
			context?: import('./types').LogContext
		) =>
			scrapingLogger.info('Scraping operation started', {
				...context,
				platform,
				searchType,
				targetCount,
			}),

		progress: (
			platform: string,
			currentCount: number,
			targetCount: number,
			context?: import('./types').LogContext
		) =>
			scrapingLogger.debug('Scraping progress update', {
				...context,
				platform,
				currentCount,
				targetCount,
				progressPercent: Math.round((currentCount / targetCount) * 100),
			}),

		completed: (
			platform: string,
			finalCount: number,
			duration: number,
			context?: import('./types').LogContext
		) =>
			scrapingLogger.info('Scraping operation completed', {
				...context,
				platform,
				resultCount: finalCount,
				executionTime: duration,
			}),

		failed: (platform: string, error: Error, context?: import('./types').LogContext) =>
			scrapingLogger.error('Scraping operation failed', error, { ...context, platform }),
	},
};

/**
 * Development helpers
 * These are only active in development mode
 */
export const devLogger = {
	/**
	 * Component lifecycle logging (React components)
	 */
	component:
		process.env.NODE_ENV === 'development'
			? {
					mount: (componentName: string, props?: unknown) =>
						logger.debug(
							`Component mounted: ${componentName}`,
							{
								componentName,
								props: JSON.stringify(props).substring(0, 200),
							},
							LogCategory.UI
						),

					update: (componentName: string, changes?: unknown) =>
						logger.debug(
							`Component updated: ${componentName}`,
							{
								componentName,
								changes: JSON.stringify(changes).substring(0, 200),
							},
							LogCategory.UI
						),

					unmount: (componentName: string) =>
						logger.debug(
							`Component unmounted: ${componentName}`,
							{ componentName },
							LogCategory.UI
						),
				}
			: {
					mount: () => undefined,
					update: () => undefined,
					unmount: () => undefined,
				},

	/**
	 * State change logging
	 */
	state:
		process.env.NODE_ENV === 'development'
			? {
					change: (stateName: string, before: unknown, after: unknown) =>
						logger.debug(
							`State changed: ${stateName}`,
							{
								stateName,
								before: JSON.stringify(before).substring(0, 100),
								after: JSON.stringify(after).substring(0, 100),
							},
							LogCategory.UI
						),
				}
			: {
					change: () => undefined,
				},
};

/**
 * Migration helper for existing structuredConsole.log statements
 * Use this to gradually replace structuredConsole.log calls while maintaining functionality
 */
export const migration = {
	/**
	 * Drop-in replacement for structuredConsole.log
	 * Provides structured logging while maintaining similar interface
	 */
	console: {
		log: (message: unknown, ...args: unknown[]) => {
			const fullMessage =
				typeof message === 'string'
					? `${message} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`
					: JSON.stringify(message);

			logger.debug(fullMessage, {}, LogCategory.SYSTEM);
		},

		info: (message: unknown, ...args: unknown[]) => {
			const fullMessage =
				typeof message === 'string'
					? `${message} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`
					: JSON.stringify(message);

			logger.info(fullMessage, {}, LogCategory.SYSTEM);
		},

		warn: (message: unknown, ...args: unknown[]) => {
			const fullMessage =
				typeof message === 'string'
					? `${message} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`
					: JSON.stringify(message);

			logger.warn(fullMessage, {}, LogCategory.SYSTEM);
		},

		error: (message: unknown, ...args: unknown[]) => {
			const fullMessage =
				typeof message === 'string'
					? `${message} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`
					: JSON.stringify(message);

			const error = args.find((arg) => arg instanceof Error);
			logger.error(fullMessage, error, {}, LogCategory.SYSTEM);
		},
	},
};

// LogLevel and LogCategory already exported above at line 49
