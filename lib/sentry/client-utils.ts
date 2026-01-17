'use client';

/**
 * Sentry Client-Side Utilities
 *
 * Helper functions for client-side Sentry instrumentation.
 * These provide consistent breadcrumb and error capture patterns.
 *
 * @example
 * ```tsx
 * import { validatePropType, addComponentBreadcrumb } from '@/lib/sentry/client-utils';
 *
 * function MyComponent({ jobId }) {
 *   useEffect(() => {
 *     addComponentBreadcrumb('MyComponent', 'mount', { jobId });
 *     validatePropType('MyComponent', 'jobId', jobId, 'string');
 *   }, [jobId]);
 * }
 * ```
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Validate a prop and capture to Sentry if invalid
 * @returns true if valid, false if invalid
 */
export function validatePropType(
	componentName: string,
	propName: string,
	value: unknown,
	expectedType: string
): boolean {
	const actualType = typeof value;
	if (actualType !== expectedType) {
		Sentry.captureMessage(`Invalid prop type in ${componentName}`, {
			level: 'warning',
			tags: {
				component: componentName,
				propName,
				bugType: 'invalid-prop-type',
			},
			extra: {
				expected: expectedType,
				actual: actualType,
				value: JSON.stringify(value).slice(0, 100),
			},
		});
		return false;
	}
	return true;
}

/**
 * Add a breadcrumb for hook state changes
 */
export function addHookBreadcrumb(
	hookName: string,
	action: string,
	data?: Record<string, unknown>
): void {
	Sentry.addBreadcrumb({
		category: 'hook',
		message: `${hookName}: ${action}`,
		level: 'info',
		data,
	});
}

/**
 * Add a breadcrumb for component lifecycle events
 */
export function addComponentBreadcrumb(
	componentName: string,
	event: 'mount' | 'unmount' | 'update',
	data?: Record<string, unknown>
): void {
	Sentry.addBreadcrumb({
		category: 'component',
		message: `${componentName} ${event}`,
		level: 'info',
		data,
	});
}

/**
 * Add a breadcrumb for API/network operations
 */
export function addNetworkBreadcrumb(
	operation: string,
	endpoint: string,
	data?: Record<string, unknown>
): void {
	Sentry.addBreadcrumb({
		category: 'network',
		message: `${operation}: ${endpoint}`,
		level: 'info',
		data,
	});
}

/**
 * Add an error breadcrumb (for failed operations that don't throw)
 */
export function addErrorBreadcrumb(message: string, data?: Record<string, unknown>): void {
	Sentry.addBreadcrumb({
		category: 'error',
		message,
		level: 'error',
		data,
	});
}

/**
 * Capture an invalid state without throwing
 * Use when you encounter unexpected state but want to continue execution
 */
export function captureInvalidState(context: string, details: Record<string, unknown>): void {
	Sentry.captureMessage(`Invalid state: ${context}`, {
		level: 'warning',
		tags: {
			bugType: 'invalid-state',
		},
		extra: details,
	});
}
