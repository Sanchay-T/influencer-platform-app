/**
 * Sentry Logger Stub (No-Op Implementation)
 *
 * Sentry has been removed from this project. This file provides no-op
 * implementations to prevent breaking existing code that references SentryLogger.
 *
 * All logging now goes through the standard console/structured logging system.
 */

import { structuredConsole } from '@/lib/logging/console-proxy';
import type { LogCategory, LogContext, LogEntry, LogLevel } from './types';

/**
 * No-op Sentry Logger Class
 * All methods are stubs that do nothing or delegate to console logging.
 */
export class SentryLogger {
	private static isInitialized = false;

	/**
	 * Initialize (no-op)
	 */
	private static initialize(): void {
		if (SentryLogger.isInitialized) return;
		SentryLogger.isInitialized = true;
	}

	/**
	 * Capture exception (logs to console instead)
	 */
	public static captureException(
		error: unknown,
		context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
	): string {
		const err = error instanceof Error ? error : new Error(String(error));
		structuredConsole.error('[ERROR]', err.message, context);
		return 'no-sentry-id';
	}

	/**
	 * Capture message (logs to console instead)
	 */
	public static captureMessage(message: string, level?: string): string {
		structuredConsole.log(`[${level?.toUpperCase() || 'INFO'}]`, message);
		return 'no-sentry-id';
	}

	/**
	 * Add breadcrumb (no-op)
	 */
	public static addBreadcrumb(breadcrumb: {
		category?: string;
		message?: string;
		level?: string;
		data?: Record<string, unknown>;
	}): void {
		// No-op: breadcrumbs were Sentry-specific
	}

	/**
	 * Set user context (no-op)
	 */
	public static setUser(
		user: { id?: string; email?: string; [key: string]: unknown } | null
	): void {
		// No-op: user context was Sentry-specific
	}

	/**
	 * Set tag (no-op)
	 */
	public static setTag(key: string, value: string): void {
		// No-op: tags were Sentry-specific
	}

	/**
	 * Set extra context (no-op)
	 */
	public static setExtra(key: string, value: unknown): void {
		// No-op: extra context was Sentry-specific
	}

	/**
	 * Set context (no-op)
	 */
	public static setContext(name: string, context: Record<string, unknown> | null): void {
		// No-op: context was Sentry-specific
	}

	/**
	 * Start transaction (returns no-op transaction)
	 */
	public static startTransaction(context: { name: string; op?: string; description?: string }): {
		finish: () => void;
		setStatus: (status: string) => void;
	} {
		return {
			finish: () => {},
			setStatus: () => {},
		};
	}

	/**
	 * Start span (returns no-op span)
	 */
	public static startSpan<T>(context: { name: string; op?: string }, callback: () => T): T {
		return callback();
	}

	/**
	 * Flush (no-op, returns immediately)
	 */
	public static async flush(timeout: number = 5000): Promise<boolean> {
		return true;
	}

	/**
	 * Log entry to Sentry (logs to console instead)
	 */
	public static logToSentry(entry: LogEntry, sentryContext?: any): void {
		// Delegate to console logging
		const level = entry.level?.toString().toLowerCase() || 'info';
		if (level === 'error' || level === 'critical') {
			structuredConsole.error(`[${entry.category || 'LOG'}]`, entry.message, entry.context);
		} else if (level === 'warn') {
			structuredConsole.warn(`[${entry.category || 'LOG'}]`, entry.message, entry.context);
		} else {
			structuredConsole.log(`[${entry.category || 'LOG'}]`, entry.message, entry.context);
		}
	}

	/**
	 * Configure scope (no-op)
	 */
	public static configureScope(callback: (scope: any) => void): void {
		// No-op: scope configuration was Sentry-specific
	}

	/**
	 * With scope (executes callback without scope)
	 */
	public static withScope<T>(callback: (scope: any) => T): T {
		const noopScope = {
			setTag: () => {},
			setExtra: () => {},
			setContext: () => {},
			setUser: () => {},
			setLevel: () => {},
			addBreadcrumb: () => {},
		};
		return callback(noopScope);
	}
}

/**
 * Convenience instance for direct usage
 */
export const sentry = SentryLogger;
