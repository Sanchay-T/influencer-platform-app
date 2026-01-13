'use client';

import { useUser } from '@clerk/nextjs';
import { useCallback, useMemo } from 'react';
import { LogCategory, type LogContext, LogLevel } from '../types';
import { emitClientLog, getClientLogGates, mergeContext, safeSerialize } from './helpers';

// Breadcrumb: useApiLogger -> fetch instrumentation -> propagates to logger.

export function useApiLogger() {
	const { user } = useUser();
	const { info: canLogInfo, warn: canLogWarn, error: canLogError } = getClientLogGates();

	const baseContext = useMemo<LogContext>(
		() => ({
			userId: user?.id,
			userEmail: user?.primaryEmailAddress?.emailAddress,
		}),
		[user?.id, user?.primaryEmailAddress?.emailAddress]
	);

	const logApiCall = useCallback(
		async (
			endpoint: string,
			options: RequestInit & { body?: unknown } = {},
			context?: LogContext
		): Promise<unknown> => {
			const startTime = performance.now();
			const method = options.method || 'GET';

			if (canLogInfo) {
				emitClientLog(
					LogLevel.INFO,
					() => `API request started: ${method} ${endpoint}`,
					() =>
						mergeContext(baseContext, {
							endpoint,
							method,
							hasBody: !!options.body,
							...context,
						}),
					LogCategory.API
				);
			}

			try {
				const response = await fetch(endpoint, options);
				const duration = performance.now() - startTime;

				if (!response.ok) {
					const errorText = await response.text();

					if (canLogWarn) {
						emitClientLog(
							LogLevel.WARN,
							() => `API request failed: ${method} ${endpoint}`,
							() =>
								mergeContext(baseContext, {
									endpoint,
									method,
									statusCode: response.status,
									executionTime: duration,
									errorText,
									...context,
								}),
							LogCategory.API
						);
					}

					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}

				const data = await response.json();

				if (canLogInfo) {
					emitClientLog(
						LogLevel.INFO,
						() => `API request completed: ${method} ${endpoint}`,
						() =>
							mergeContext(baseContext, {
								endpoint,
								method,
								statusCode: response.status,
								executionTime: duration,
								responsePreview: safeSerialize(data, 400),
								...context,
							}),
						LogCategory.API
					);
				}

				return data;
			} catch (error) {
				const duration = performance.now() - startTime;

				if (canLogError) {
					const normalizedError = error instanceof Error ? error : new Error(String(error));
					emitClientLog(
						LogLevel.ERROR,
						() => `API request error: ${method} ${endpoint}`,
						() =>
							mergeContext(baseContext, {
								endpoint,
								method,
								executionTime: duration,
								...context,
							}),
						LogCategory.API,
						normalizedError
					);
				}

				throw error;
			}
		},
		[baseContext, canLogError, canLogInfo, canLogWarn]
	);

	return {
		logApiCall,
	};
}
