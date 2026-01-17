'use client';

/**
 * Sentry-Integrated Error Boundary
 *
 * Catches React errors and reports them to Sentry with user context.
 * Provides a fallback UI for users when errors occur.
 *
 * @example
 * ```tsx
 * <ErrorBoundary feature="search" platform="tiktok">
 *   <SearchResults />
 * </ErrorBoundary>
 * ```
 */

import * as Sentry from '@sentry/nextjs';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
	children: ReactNode;
	/** Feature name for Sentry tagging (e.g., 'search', 'onboarding', 'billing') */
	feature?: string;
	/** Platform if applicable (e.g., 'tiktok', 'instagram', 'youtube') */
	platform?: string;
	/** Custom fallback component */
	fallback?: ReactNode;
	/** Callback when error is caught */
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	/** Custom error message to display */
	errorMessage?: string;
	/** Show retry button */
	showRetry?: boolean;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	eventId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			eventId: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		const { feature, platform, onError } = this.props;

		// Add breadcrumb with full context before capturing
		// @why This shows the component tree state when the error occurred
		Sentry.addBreadcrumb({
			category: 'error',
			message: `Error boundary caught error in ${feature || 'unknown'} feature`,
			level: 'error',
			data: {
				componentStack: errorInfo.componentStack?.slice(0, 500),
				feature,
				platform,
			},
		});

		// Extract component name from stack for tagging
		const componentName = this.extractComponentName(errorInfo.componentStack);

		// Send to Sentry with enhanced context
		const eventId = Sentry.captureException(error, {
			tags: {
				feature: feature || 'unknown',
				...(platform ? { platform } : {}),
				errorBoundary: 'true',
				componentName,
			},
			extra: {
				componentStack: errorInfo.componentStack,
				digest: errorInfo.digest ?? undefined,
			},
			contexts: {
				react: {
					componentStack: errorInfo.componentStack,
				},
			},
		});

		this.setState({ eventId });

		// Call custom error handler if provided
		onError?.(error, errorInfo);

		// Log to console for local debugging
		console.error('[ErrorBoundary]', {
			feature,
			platform,
			componentName,
			error: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
			eventId,
		});
	}

	/**
	 * Extract the failing component name from the React component stack
	 * @why Helps identify which component failed without reading the full stack
	 */
	private extractComponentName(componentStack?: string | null): string {
		if (!componentStack) {
			return 'Unknown';
		}
		// Component stack format: "\n    at ComponentName (file:line:col)"
		const match = componentStack.match(/^\s+at (\w+)/);
		return match?.[1] || 'Unknown';
	}

	handleRetry = () => {
		this.setState({ hasError: false, error: null, eventId: null });
	};

	handleReport = () => {
		const { eventId } = this.state;
		if (eventId) {
			Sentry.showReportDialog({ eventId });
		}
	};

	render() {
		const { hasError, error, eventId } = this.state;
		const {
			children,
			fallback,
			feature,
			errorMessage = 'Something went wrong',
			showRetry = true,
		} = this.props;

		if (hasError) {
			// Return custom fallback if provided
			if (fallback) {
				return fallback;
			}

			// Default error UI
			return (
				<div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-gray-50 rounded-lg border border-gray-200">
					<AlertCircle className="w-12 h-12 text-red-500 mb-4" />
					<h3 className="text-lg font-semibold text-gray-900 mb-2">{errorMessage}</h3>
					<p className="text-sm text-gray-600 mb-4 text-center max-w-md">
						{feature && `An error occurred in the ${feature} feature. `}
						Our team has been notified and is working on a fix.
					</p>

					{process.env.NODE_ENV === 'development' && error && (
						<details className="mb-4 w-full max-w-md">
							<summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
								Error details (dev only)
							</summary>
							<pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-32">
								{error.message}
								{'\n\n'}
								{error.stack}
							</pre>
						</details>
					)}

					<div className="flex gap-3">
						{showRetry && (
							<button
								onClick={this.handleRetry}
								className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
							>
								<RefreshCw className="w-4 h-4" />
								Try Again
							</button>
						)}

						{eventId && (
							<button
								onClick={this.handleReport}
								className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
							>
								Report Issue
							</button>
						)}
					</div>

					{eventId && <p className="mt-4 text-xs text-gray-400">Error ID: {eventId}</p>}
				</div>
			);
		}

		return children;
	}
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
	WrappedComponent: React.ComponentType<P>,
	options: Omit<ErrorBoundaryProps, 'children'> = {}
) {
	const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

	const ComponentWithErrorBoundary = (props: P) => (
		<ErrorBoundary {...options}>
			<WrappedComponent {...props} />
		</ErrorBoundary>
	);

	ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

	return ComponentWithErrorBoundary;
}

export default ErrorBoundary;
