'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LogCategory, type LogContext, LogLevel } from '../types';
import { emitClientLog, getClientLogGates, mergeContext, safeSerialize } from './helpers';

// Breadcrumb: useComponentLogger -> UI lifecycle tracing -> flows into centralized logger via emitClientLog.

export function useComponentLogger(componentName: string, initialProps?: any) {
	const {
		debug: canLogDebug,
		info: canLogInfo,
		warn: canLogWarn,
		error: canLogError,
	} = getClientLogGates();
	const mountedRef = useRef(false);
	const propsRef = useRef(initialProps);

	const baseContext = useMemo<LogContext>(() => ({ componentName }), [componentName]);

	const createContext = useCallback(
		(additionalContext?: LogContext): LogContext => {
			return mergeContext(baseContext, additionalContext);
		},
		[baseContext]
	);

	useEffect(() => {
		if (!canLogDebug) {
			mountedRef.current = true;
			return;
		}

		if (!mountedRef.current) {
			mountedRef.current = true;

			emitClientLog(
				LogLevel.DEBUG,
				() => `Component mounted: ${componentName}`,
				() =>
					createContext({
						initialProps: safeSerialize(initialProps),
					}),
				LogCategory.UI
			);
		}
	}, [canLogDebug, componentName, createContext, initialProps]);

	useEffect(() => {
		if (!canLogDebug) {
			return;
		}

		return () => {
			if (mountedRef.current) {
				emitClientLog(
					LogLevel.DEBUG,
					() => `Component unmounted: ${componentName}`,
					() => createContext(),
					LogCategory.UI
				);
			}
		};
	}, [canLogDebug, componentName, createContext]);

	const logUpdate = useCallback(
		(changes: any, reason?: string) => {
			const previousProps = propsRef.current;
			propsRef.current = changes;

			if (!canLogDebug) {
				return;
			}

			emitClientLog(
				LogLevel.DEBUG,
				() => `Component updated: ${componentName}`,
				() =>
					createContext({
						changes: safeSerialize(changes),
						updateReason: reason,
						previousProps: safeSerialize(previousProps),
					}),
				LogCategory.UI
			);
		},
		[canLogDebug, componentName, createContext]
	);

	const logError = useCallback(
		(error: Error, context?: LogContext) => {
			if (!canLogError) {
				return;
			}

			emitClientLog(
				LogLevel.ERROR,
				() => `Component error in ${componentName}: ${error.message}`,
				() => createContext(context),
				LogCategory.UI,
				error
			);
		},
		[canLogError, componentName, createContext]
	);

	const logWarning = useCallback(
		(message: string, context?: LogContext) => {
			if (!canLogWarn) {
				return;
			}

			emitClientLog(
				LogLevel.WARN,
				() => `Component warning in ${componentName}: ${message}`,
				() => createContext(context),
				LogCategory.UI
			);
		},
		[canLogWarn, componentName, createContext]
	);

	const logInfo = useCallback(
		(message: string, context?: LogContext) => {
			if (!canLogInfo) {
				return;
			}

			emitClientLog(
				LogLevel.INFO,
				() => `${componentName}: ${message}`,
				() => createContext(context),
				LogCategory.UI
			);
		},
		[canLogInfo, componentName, createContext]
	);

	return {
		logUpdate,
		logError,
		logWarning,
		logInfo,
		createContext,
	};
}

export function usePerformanceLogger(componentName: string) {
	const {
		debug: canLogDebug,
		info: canLogInfo,
		warn: canLogWarn,
		error: canLogError,
	} = getClientLogGates();
	const renderTimerRef = useRef<{ start: number; count: number }>({ start: 0, count: 0 });

	const baseContext = useMemo<LogContext>(() => ({ componentName }), [componentName]);

	const createContext = useCallback(
		(additionalContext?: LogContext): LogContext => {
			return mergeContext(baseContext, additionalContext);
		},
		[baseContext]
	);

	useEffect(() => {
		if (!(canLogDebug || canLogWarn)) {
			renderTimerRef.current = {
				start: performance.now(),
				count: renderTimerRef.current.count + 1,
			};
			return;
		}

		const startTime = performance.now();
		renderTimerRef.current = { start: startTime, count: renderTimerRef.current.count + 1 };

		return () => {
			const duration = performance.now() - startTime;

			if (duration > 100) {
				if (!canLogWarn) {
					return;
				}

				emitClientLog(
					LogLevel.WARN,
					() => `Slow render detected in ${componentName}`,
					() =>
						createContext({
							renderDuration: duration,
							renderCount: renderTimerRef.current.count,
						}),
					LogCategory.PERFORMANCE
				);
				return;
			}

			if (!canLogDebug) {
				return;
			}

			emitClientLog(
				LogLevel.DEBUG,
				() => `Component rendered: ${componentName}`,
				() =>
					createContext({
						renderDuration: duration,
						renderCount: renderTimerRef.current.count,
					}),
				LogCategory.PERFORMANCE
			);
		};
	}, [canLogDebug, canLogWarn, componentName, createContext]);

	const trackAsyncOperation = useCallback(
		async <T>(
			operationName: string,
			operation: () => Promise<T>,
			context?: LogContext
		): Promise<T> => {
			const startTime = performance.now();

			try {
				const result = await operation();
				const duration = performance.now() - startTime;

				if (canLogInfo) {
					emitClientLog(
						LogLevel.INFO,
						() => `Async operation completed: ${operationName}`,
						() =>
							createContext({
								operationName,
								executionTime: duration,
								...context,
							}),
						LogCategory.PERFORMANCE
					);
				}

				return result;
			} catch (error) {
				const duration = performance.now() - startTime;

				if (canLogError) {
					const normalizedError = error instanceof Error ? error : new Error(String(error));
					emitClientLog(
						LogLevel.ERROR,
						() => `Async operation failed: ${operationName}`,
						() =>
							createContext({
								operationName,
								executionTime: duration,
								...context,
							}),
						LogCategory.PERFORMANCE,
						normalizedError
					);
				}

				throw error;
			}
		},
		[canLogError, canLogInfo, createContext]
	);

	const trackSyncOperation = useCallback(
		<T>(operationName: string, operation: () => T, context?: LogContext): T => {
			const startTime = performance.now();

			try {
				const result = operation();
				const duration = performance.now() - startTime;

				if (duration > 50 && canLogInfo) {
					emitClientLog(
						LogLevel.INFO,
						() => `Sync operation completed: ${operationName}`,
						() =>
							createContext({
								operationName,
								executionTime: duration,
								...context,
							}),
						LogCategory.PERFORMANCE
					);
				}

				return result;
			} catch (error) {
				const duration = performance.now() - startTime;

				if (canLogError) {
					const normalizedError = error instanceof Error ? error : new Error(String(error));
					emitClientLog(
						LogLevel.ERROR,
						() => `Sync operation failed: ${operationName}`,
						() =>
							createContext({
								operationName,
								executionTime: duration,
								...context,
							}),
						LogCategory.PERFORMANCE,
						normalizedError
					);
				}

				throw error;
			}
		},
		[canLogError, canLogInfo, createContext]
	);

	return {
		trackAsyncOperation,
		trackSyncOperation,
	};
}
