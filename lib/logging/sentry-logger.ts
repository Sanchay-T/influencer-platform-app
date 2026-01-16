/**
 * Sentry Logger - Real Implementation
 *
 * This module bridges the custom logging system with Sentry.
 * It provides methods to capture errors, messages, and performance metrics
 * with rich context for debugging.
 *
 * @example
 * ```typescript
 * import { SentryLogger } from '@/lib/logging';
 *
 * // Capture an exception
 * SentryLogger.captureException(error, {
 *   tags: { feature: 'search', platform: 'tiktok' },
 *   extra: { userId, query }
 * });
 *
 * // Set user context
 * SentryLogger.setUser({ id: userId, email, plan: 'viral_surge' });
 * ```
 */

import * as Sentry from '@sentry/nextjs';
import { structuredConsole } from '@/lib/logging/console-proxy';
import type { LogEntry } from './types';

// Type for Sentry severity levels
type SentrySeverity = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

/**
 * Map log levels to Sentry severity
 */
function mapLogLevelToSeverity(level: string | undefined): SentrySeverity {
	const levelStr = String(level).toLowerCase();
	switch (levelStr) {
		case 'critical':
		case 'fatal':
			return 'fatal';
		case 'error':
			return 'error';
		case 'warn':
		case 'warning':
			return 'warning';
		case 'info':
			return 'info';
		case 'debug':
			return 'debug';
		default:
			return 'log';
	}
}

/**
 * Check if Sentry is properly configured
 */
function isSentryEnabled(): boolean {
	return !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Sentry Logger Class
 * Provides integration between the custom logging system and Sentry.
 */
export class SentryLogger {
	private static isInitialized = false;

	/**
	 * Initialize Sentry (called automatically on first use)
	 */
	private static initialize(): void {
		if (SentryLogger.isInitialized) return;
		SentryLogger.isInitialized = true;
	}

	/**
	 * Capture an exception and send it to Sentry
	 * @returns The Sentry event ID for reference
	 */
	public static captureException(
		error: unknown,
		context?: {
			tags?: Record<string, string>;
			extra?: Record<string, unknown>;
			user?: { id?: string; email?: string; [key: string]: unknown };
			level?: SentrySeverity;
		}
	): string {
		SentryLogger.initialize();

		const err = error instanceof Error ? error : new Error(String(error));

		// Always log to console for local debugging
		structuredConsole.error('[SENTRY]', err.message, context);

		// Send to Sentry if enabled
		if (isSentryEnabled()) {
			return Sentry.captureException(err, {
				tags: context?.tags,
				extra: context?.extra,
				user: context?.user,
				level: context?.level || 'error',
			});
		}

		return 'sentry-not-configured';
	}

	/**
	 * Capture a message and send it to Sentry
	 * @returns The Sentry event ID for reference
	 */
	public static captureMessage(
		message: string,
		level: SentrySeverity = 'info',
		context?: {
			tags?: Record<string, string>;
			extra?: Record<string, unknown>;
		}
	): string {
		SentryLogger.initialize();

		// Log to console
		structuredConsole.log(`[SENTRY:${level.toUpperCase()}]`, message);

		// Send to Sentry if enabled
		if (isSentryEnabled()) {
			return Sentry.captureMessage(message, {
				level,
				tags: context?.tags,
				extra: context?.extra,
			});
		}

		return 'sentry-not-configured';
	}

	/**
	 * Add a breadcrumb for debugging
	 * Breadcrumbs are included with error reports to show what happened before the error
	 */
	public static addBreadcrumb(breadcrumb: {
		category?: string;
		message?: string;
		level?: SentrySeverity;
		data?: Record<string, unknown>;
	}): void {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			Sentry.addBreadcrumb({
				category: breadcrumb.category,
				message: breadcrumb.message,
				level: breadcrumb.level,
				data: breadcrumb.data,
				timestamp: Date.now() / 1000,
			});
		}
	}

	/**
	 * Set the current user context
	 * This is associated with all subsequent error reports
	 */
	public static setUser(
		user: {
			id?: string;
			email?: string;
			username?: string;
			plan?: string;
			subscriptionStatus?: string;
			[key: string]: unknown;
		} | null
	): void {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			Sentry.setUser(user);
		}
	}

	/**
	 * Set a tag that will be included with all subsequent events
	 */
	public static setTag(key: string, value: string): void {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			Sentry.setTag(key, value);
		}
	}

	/**
	 * Set extra context data
	 */
	public static setExtra(key: string, value: unknown): void {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			Sentry.setExtra(key, value);
		}
	}

	/**
	 * Set structured context (grouped extra data)
	 */
	public static setContext(name: string, context: Record<string, unknown> | null): void {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			Sentry.setContext(name, context);
		}
	}

	/**
	 * Start a performance transaction for monitoring
	 * @deprecated Use startSpan instead for the new Sentry API
	 */
	public static startTransaction(context: { name: string; op?: string; description?: string }): {
		finish: () => void;
		setStatus: (status: string) => void;
	} {
		SentryLogger.initialize();

		// Fallback for compatibility
		return {
			finish: () => {},
			setStatus: () => {},
		};
	}

	/**
	 * Start a span for performance monitoring
	 * Use this to measure the duration of operations
	 */
	public static startSpan<T>(
		context: {
			name: string;
			op?: string;
			attributes?: Record<string, string | number | boolean>;
		},
		callback: () => T
	): T {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			return Sentry.startSpan(
				{
					name: context.name,
					op: context.op,
					attributes: context.attributes,
				},
				callback
			);
		}

		return callback();
	}

	/**
	 * Start an async span for performance monitoring
	 */
	public static async startSpanAsync<T>(
		context: {
			name: string;
			op?: string;
			attributes?: Record<string, string | number | boolean>;
		},
		callback: () => Promise<T>
	): Promise<T> {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			return Sentry.startSpan(
				{
					name: context.name,
					op: context.op,
					attributes: context.attributes,
				},
				async () => callback()
			);
		}

		return callback();
	}

	/**
	 * Flush all pending events to Sentry
	 * Call this before the process exits (e.g., in serverless functions)
	 */
	public static async flush(timeout: number = 5000): Promise<boolean> {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			return Sentry.flush(timeout);
		}

		return true;
	}

	/**
	 * Log entry to Sentry
	 * Bridge method to convert LogEntry to Sentry event
	 */
	public static logToSentry(entry: LogEntry, sentryContext?: unknown): void {
		SentryLogger.initialize();

		const level = mapLogLevelToSeverity(entry.level?.toString());
		const context = entry.context as Record<string, unknown> | undefined;

		// If Sentry isn't enabled, just log to console
		if (!isSentryEnabled()) {
			if (level === 'error' || level === 'fatal') {
				structuredConsole.error(`[${entry.category || 'LOG'}]`, entry.message, context);
			} else if (level === 'warning') {
				structuredConsole.warn(`[${entry.category || 'LOG'}]`, entry.message, context);
			} else {
				structuredConsole.log(`[${entry.category || 'LOG'}]`, entry.message, context);
			}
			return;
		}

		// If it's an error-level log, capture as exception
		if (level === 'error' || level === 'fatal') {
			const error = context?.error instanceof Error ? context.error : new Error(entry.message);

			// Extract requestId from context if available
			const requestId = context?.requestId as string | undefined;

			Sentry.captureException(error, {
				level,
				tags: {
					category: String(entry.category || 'unknown'),
					...(requestId ? { requestId } : {}),
				},
				extra: {
					...context,
					timestamp: entry.timestamp,
				},
			});
		} else {
			// For non-errors, add as breadcrumb instead of flooding Sentry
			Sentry.addBreadcrumb({
				category: String(entry.category || 'log'),
				message: entry.message,
				level,
				data: context,
				timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() / 1000 : Date.now() / 1000,
			});
		}
	}

	/**
	 * Configure scope for the current context
	 */
	public static configureScope(callback: (scope: Sentry.Scope) => void): void {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			const scope = Sentry.getCurrentScope();
			if (scope) {
				callback(scope);
			}
		}
	}

	/**
	 * Run a callback with an isolated scope
	 */
	public static withScope<T>(callback: (scope: Sentry.Scope) => T): T {
		SentryLogger.initialize();

		if (isSentryEnabled()) {
			return Sentry.withScope(callback);
		}

		// Provide a mock scope if Sentry isn't enabled
		const noopScope = {
			setTag: () => noopScope,
			setExtra: () => noopScope,
			setContext: () => noopScope,
			setUser: () => noopScope,
			setLevel: () => noopScope,
			addBreadcrumb: () => noopScope,
		} as unknown as Sentry.Scope;

		return callback(noopScope);
	}
}

/**
 * Convenience instance for direct usage
 */
export const sentry = SentryLogger;

/**
 * Helper to set up user context from Clerk auth
 */
export function setUserFromClerk(user: {
	userId: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	subscriptionPlan?: string;
	subscriptionStatus?: string;
}): void {
	SentryLogger.setUser({
		id: user.userId,
		email: user.email,
		username: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
		plan: user.subscriptionPlan,
		subscriptionStatus: user.subscriptionStatus,
	});
}

/**
 * Helper to track feature usage
 */
export function trackFeatureUsage(feature: string, metadata?: Record<string, unknown>): void {
	SentryLogger.addBreadcrumb({
		category: 'feature',
		message: `Used feature: ${feature}`,
		level: 'info',
		data: metadata,
	});
}

/**
 * Helper to track API calls
 */
export function trackApiCall(
	endpoint: string,
	method: string,
	duration: number,
	status: number
): void {
	SentryLogger.addBreadcrumb({
		category: 'api',
		message: `${method} ${endpoint} → ${status}`,
		level: status >= 400 ? 'warning' : 'info',
		data: {
			endpoint,
			method,
			duration,
			status,
		},
	});
}
