'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogCategory, logger } from '@/lib/logging';

/**
 * Error Boundary State
 */
interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
	errorId: string | null;
}

/**
 * Error Boundary Props
 */
interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ComponentType<{
		error: Error;
		errorInfo: React.ErrorInfo;
		resetError: () => void;
	}>;
	componentName?: string;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	resetOnPropsChange?: boolean;
	resetKeys?: Array<string | number>;
}

/**
 * Default Error Fallback Component
 */
const DefaultErrorFallback: React.FC<{
	error: Error;
	errorInfo: React.ErrorInfo;
	resetError: () => void;
	componentName?: string;
}> = ({ error, errorInfo, resetError, componentName }) => {
	return (
		<Card className="bg-red-50 border-red-200">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-red-700">
					<AlertTriangle className="h-5 w-5" />
					Component Error{componentName && ` in ${componentName}`}
				</CardTitle>
				<CardDescription className="text-red-600">
					An unexpected error occurred while rendering this component.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<details className="bg-white border border-red-200 rounded p-3">
					<summary className="cursor-pointer font-medium text-red-800">Error Details</summary>
					<div className="mt-2 text-sm text-red-700">
						<div className="font-mono bg-red-50 p-2 rounded mt-2">{error.message}</div>
						{error.stack && (
							<div className="font-mono text-xs bg-red-50 p-2 rounded mt-2 overflow-x-auto">
								{error.stack}
							</div>
						)}
					</div>
				</details>
				<Button
					onClick={resetError}
					variant="outline"
					className="border-red-300 text-red-700 hover:bg-red-50"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Try Again
				</Button>
			</CardContent>
		</Card>
	);
};

/**
 * React Error Boundary with Sentry Integration
 *
 * Catches React component errors, logs them through our structured logging system,
 * and provides a fallback UI. Integrates with Sentry for error tracking.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	private resetTimeoutId: number | null = null;

	constructor(props: ErrorBoundaryProps) {
		super(props);

		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		// Update state so the next render will show the fallback UI
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Generate unique error ID for tracking
		const errorId = `react-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Log error through structured logging system
		logger.error(
			`React component error${this.props.componentName ? ` in ${this.props.componentName}` : ''}`,
			error,
			{
				componentName: this.props.componentName,
				errorId,
				componentStack: errorInfo.componentStack,
				errorBoundary: true,
				errorInfo: {
					componentStack: errorInfo.componentStack,
					errorBoundary: this.constructor.name,
				},
			},
			LogCategory.UI
		);

		// Update state with error info
		this.setState({
			error,
			errorInfo,
			errorId,
		});

		// Call custom error handler if provided
		this.props.onError?.(error, errorInfo);
	}

	componentDidUpdate(prevProps: ErrorBoundaryProps) {
		const { resetOnPropsChange, resetKeys } = this.props;
		const { hasError } = this.state;

		// Reset error state when specified props change
		if (hasError && prevProps.children !== this.props.children) {
			if (resetOnPropsChange) {
				this.resetError();
			}
		}

		// Reset error state when reset keys change
		if (hasError && resetKeys && prevProps.resetKeys) {
			const hasResetKeyChanged = resetKeys.some(
				(key, index) => key !== prevProps.resetKeys?.[index]
			);
			if (hasResetKeyChanged) {
				this.resetError();
			}
		}
	}

	componentWillUnmount() {
		if (this.resetTimeoutId) {
			window.clearTimeout(this.resetTimeoutId);
		}
	}

	resetError = () => {
		logger.info(
			`Error boundary reset${this.props.componentName ? ` for ${this.props.componentName}` : ''}`,
			{
				componentName: this.props.componentName,
				errorId: this.state.errorId,
				previousError: this.state.error?.message,
			},
			LogCategory.UI
		);

		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: null,
		});
	};

	render() {
		const { hasError, error, errorInfo } = this.state;
		const { children, fallback: FallbackComponent } = this.props;

		if (hasError && error && errorInfo) {
			// Render custom fallback component if provided
			if (FallbackComponent) {
				return (
					<FallbackComponent error={error} errorInfo={errorInfo} resetError={this.resetError} />
				);
			}

			// Render default fallback component
			return (
				<DefaultErrorFallback
					error={error}
					errorInfo={errorInfo}
					resetError={this.resetError}
					componentName={this.props.componentName}
				/>
			);
		}

		return children;
	}
}

/**
 * Higher-Order Component to wrap components with error boundary
 *
 * @example
 * ```tsx
 * const SafeMyComponent = withErrorBoundary(MyComponent, {
 *   componentName: 'MyComponent',
 *   fallback: CustomErrorFallback
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
	const WrappedComponent = (props: P) => (
		<ErrorBoundary {...errorBoundaryProps}>
			<Component {...props} />
		</ErrorBoundary>
	);

	WrappedComponent.displayName = `withErrorBoundary(${
		Component.displayName || Component.name || 'Component'
	})`;

	return WrappedComponent;
}

/**
 * Hook for programmatic error handling in functional components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const captureError = useErrorHandler('MyComponent');
 *
 *   const handleRiskyOperation = async () => {
 *     try {
 *       await riskyOperation();
 *     } catch (error) {
 *       captureError(error, { operation: 'riskyOperation' });
 *     }
 *   };
 * }
 * ```
 */
export function useErrorHandler(componentName?: string) {
	return React.useCallback(
		(error: Error, context?: Record<string, unknown>) => {
			logger.error(
				`Error in ${componentName || 'component'}`,
				error,
				{
					componentName,
					userTriggered: true,
					...context,
				},
				LogCategory.UI
			);
		},
		[componentName]
	);
}

/**
 * Custom Error Fallback Components
 */
export const MinimalErrorFallback: React.FC<{
	error: Error;
	resetError: () => void;
}> = ({ resetError }) => (
	<div className="flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded">
		<div className="text-center">
			<AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
			<p className="text-red-700 text-sm mb-3">Something went wrong</p>
			<Button
				onClick={resetError}
				size="sm"
				variant="outline"
				className="border-red-300 text-red-700 hover:bg-red-50"
			>
				Retry
			</Button>
		</div>
	</div>
);

export const InlineErrorFallback: React.FC<{
	error: Error;
	resetError: () => void;
}> = ({ resetError }) => (
	<div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
		<AlertTriangle className="h-4 w-4" />
		<span>Error occurred</span>
		<button onClick={resetError} className="text-red-600 hover:text-red-800 underline text-xs">
			Retry
		</button>
	</div>
);
