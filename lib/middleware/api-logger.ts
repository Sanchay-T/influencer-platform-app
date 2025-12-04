/**
 * API Logging Middleware for Next.js API Routes
 *
 * Provides structured logging for all API endpoints with performance tracking,
 * request correlation, and automatic error handling integration.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { LogCategory, type LogContext, LogLevel, logger } from '../logging';
import { generateRequestId } from '../logging/constants';

/**
 * API Request Context for structured logging
 */
interface ApiRequestContext extends LogContext {
	method: string;
	url: string;
	userAgent?: string;
	ip?: string;
	contentLength?: number;
	requestBody?: any;
	queryParams?: Record<string, string>;
}

/**
 * API Response Context for structured logging
 */
interface ApiResponseContext {
	statusCode: number;
	responseTime: number;
	responseSize?: number;
	error?: Error;
	responseBody?: any;
}

/**
 * Performance timing information
 */
interface ApiTiming {
	start: number;
	end?: number;
	duration?: number;
	phases: {
		auth?: number;
		validation?: number;
		business?: number;
		database?: number;
		external?: number;
	};
}

/**
 * API Logging Middleware Class
 * Provides comprehensive request/response logging with performance tracking
 */
export class ApiLogger {
	private static instance: ApiLogger;
	private activeRequests = new Map<string, ApiTiming>();

	/**
	 * Get singleton instance
	 */
	public static getInstance(): ApiLogger {
		if (!ApiLogger.instance) {
			ApiLogger.instance = new ApiLogger();
		}
		return ApiLogger.instance;
	}

	/**
	 * Start tracking an API request
	 */
	public startRequest(
		request: NextRequest | Request,
		category: LogCategory = LogCategory.API
	): { requestId: string; timing: ApiTiming } {
		const requestId = generateRequestId();
		const timing: ApiTiming = {
			start: Date.now(),
			phases: {},
		};

		this.activeRequests.set(requestId, timing);

		// Extract request context
		const context = this.extractRequestContext(request, requestId);

		// Log request start
		logger.info('API request started', context, category);

		return { requestId, timing };
	}

	/**
	 * Log a phase completion within the request
	 */
	public logPhase(
		requestId: string,
		phase: keyof ApiTiming['phases'],
		context?: LogContext
	): number {
		const timing = this.activeRequests.get(requestId);
		if (!timing) return 0;

		const phaseTime = Date.now() - timing.start;
		timing.phases[phase] = phaseTime;

		logger.debug(
			`API phase completed: ${phase}`,
			{
				...context,
				requestId,
				phaseTime,
				totalTime: phaseTime,
			},
			LogCategory.PERFORMANCE
		);

		return phaseTime;
	}

	/**
	 * Complete request tracking and log response
	 */
	public completeRequest(
		requestId: string,
		response: NextResponse | Response,
		category: LogCategory = LogCategory.API,
		error?: Error,
		additionalContext?: LogContext
	): ApiResponseContext {
		const timing = this.activeRequests.get(requestId);
		if (!timing) {
			logger.warn('Request tracking not found', { requestId });
			return { statusCode: 500, responseTime: 0 };
		}

		timing.end = Date.now();
		timing.duration = timing.end - timing.start;

		const responseContext: ApiResponseContext = {
			statusCode: response.status,
			responseTime: timing.duration,
			error,
		};

		const logContext: LogContext = {
			...additionalContext,
			requestId,
			executionTime: timing.duration,
			statusCode: response.status,
		};

		// Log based on response status and presence of errors
		if (error || response.status >= 500) {
			logger.error('API request failed', error, logContext, category);
		} else if (response.status >= 400) {
			logger.warn('API request client error', logContext, category);
		} else if (timing.duration > 5000) {
			// Slow request threshold
			logger.warn('API request slow response', logContext, LogCategory.PERFORMANCE);
		} else {
			logger.info('API request completed', logContext, category);
		}

		// Log performance breakdown if multiple phases were tracked
		if (Object.keys(timing.phases).length > 1) {
			logger.debug(
				'API request performance breakdown',
				{
					requestId,
					totalTime: timing.duration,
					phases: timing.phases,
				},
				LogCategory.PERFORMANCE
			);
		}

		// Clean up tracking
		this.activeRequests.delete(requestId);

		return responseContext;
	}

	/**
	 * Middleware wrapper for API routes
	 */
	public withLogging<T = any>(
		handler: (
			request: NextRequest | Request,
			context: {
				requestId: string;
				logPhase: (phase: keyof ApiTiming['phases'], ctx?: LogContext) => number;
				logger: typeof logger;
			}
		) => Promise<NextResponse>,
		category: LogCategory = LogCategory.API
	) {
		return async (request: NextRequest | Request): Promise<NextResponse> => {
			const { requestId, timing } = this.startRequest(request, category);
			let response: NextResponse;
			let error: Error | undefined;

			try {
				// Create enhanced context with logging utilities
				const context = {
					requestId,
					logPhase: (phase: keyof ApiTiming['phases'], ctx?: LogContext) =>
						this.logPhase(requestId, phase, ctx),
					logger,
				};

				response = await handler(request, context);
			} catch (err) {
				error = err as Error;
				response = NextResponse.json(
					{ error: 'Internal server error', requestId },
					{ status: 500 }
				);
			}

			this.completeRequest(requestId, response, category, error);
			return response;
		};
	}

	/**
	 * Extract structured context from request
	 */
	private extractRequestContext(
		request: NextRequest | Request,
		requestId: string
	): ApiRequestContext {
		const url = new URL(request.url);

		const context: ApiRequestContext = {
			requestId,
			method: request.method,
			url: url.pathname,
			userAgent: request.headers.get('user-agent') || undefined,
			ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
			contentLength: request.headers.get('content-length')
				? parseInt(request.headers.get('content-length')!)
				: undefined,
		};

		// Add query parameters if present
		if (url.search) {
			context.queryParams = Object.fromEntries(url.searchParams.entries());
		}

		return context;
	}

	/**
	 * Log external API call with timing
	 */
	public async logExternalApiCall<T>(
		operation: string,
		apiCall: () => Promise<T>,
		context?: LogContext,
		category: LogCategory = LogCategory.API
	): Promise<T> {
		const timer = logger.startTimer(`external_api_${operation}`);
		const requestId = context?.requestId || generateRequestId();

		logger.info(
			`External API call started: ${operation}`,
			{
				...context,
				requestId,
				operation,
			},
			category
		);

		try {
			const result = await apiCall();
			const duration = timer.end();

			logger.info(
				`External API call completed: ${operation}`,
				{
					...context,
					requestId,
					operation,
					executionTime: duration,
					success: true,
				},
				category
			);

			return result;
		} catch (error) {
			const duration = timer.end();

			logger.error(
				`External API call failed: ${operation}`,
				error as Error,
				{
					...context,
					requestId,
					operation,
					executionTime: duration,
					success: false,
				},
				category
			);

			throw error;
		}
	}

	/**
	 * Log database operation with timing
	 */
	public async logDatabaseOperation<T>(
		operation: string,
		dbCall: () => Promise<T>,
		context?: LogContext
	): Promise<T> {
		const timer = logger.startTimer(`db_${operation}`);
		const requestId = context?.requestId || generateRequestId();

		logger.debug(
			`Database operation started: ${operation}`,
			{
				...context,
				requestId,
				operation,
			},
			LogCategory.DATABASE
		);

		try {
			const result = await dbCall();
			const duration = timer.end();

			// Log slow queries
			if (duration > 1000) {
				logger.warn(
					`Slow database operation: ${operation}`,
					{
						...context,
						requestId,
						operation,
						executionTime: duration,
					},
					LogCategory.DATABASE
				);
			} else {
				logger.debug(
					`Database operation completed: ${operation}`,
					{
						...context,
						requestId,
						operation,
						executionTime: duration,
					},
					LogCategory.DATABASE
				);
			}

			return result;
		} catch (error) {
			const duration = timer.end();

			logger.error(
				`Database operation failed: ${operation}`,
				error as Error,
				{
					...context,
					requestId,
					operation,
					executionTime: duration,
				},
				LogCategory.DATABASE
			);

			throw error;
		}
	}

	/**
	 * Create standardized API response with logging
	 */
	public createResponse(
		data: any,
		status: number = 200,
		requestId?: string,
		headers?: Record<string, string>
	): NextResponse {
		const response = {
			...data,
			...(requestId && { requestId }),
			timestamp: new Date().toISOString(),
		};

		const responseHeaders = {
			'X-Request-ID': requestId || generateRequestId(),
			'X-Response-Time': Date.now().toString(),
			...headers,
		};

		return NextResponse.json(response, { status, headers: responseHeaders });
	}

	/**
	 * Create standardized error response with logging
	 */
	public createErrorResponse(
		error: string | Error,
		status: number = 500,
		requestId?: string,
		details?: any
	): NextResponse {
		const errorMessage = error instanceof Error ? error.message : error;
		const response = {
			error: errorMessage,
			status,
			timestamp: new Date().toISOString(),
			...(requestId && { requestId }),
			...(details && { details }),
		};

		return NextResponse.json(response, {
			status,
			headers: {
				'X-Request-ID': requestId || generateRequestId(),
				'X-Error-Time': Date.now().toString(),
			},
		});
	}
}

/**
 * Export singleton instance for global use
 */
export const apiLogger = ApiLogger.getInstance();

/**
 * Convenience functions for common patterns
 */

/**
 * Wrap API handler with automatic logging
 */
export const withApiLogging = (
	handler: (req: NextRequest | Request, ctx: any) => Promise<NextResponse>,
	category?: LogCategory
) => apiLogger.withLogging(handler, category);

/**
 * Log external API calls with automatic timing and error handling
 */
export const logExternalCall = <T>(
	operation: string,
	apiCall: () => Promise<T>,
	context?: LogContext,
	category?: LogCategory
) => apiLogger.logExternalApiCall(operation, apiCall, context, category);

/**
 * Log database operations with automatic timing and error handling
 */
export const logDbOperation = <T>(
	operation: string,
	dbCall: () => Promise<T>,
	context?: LogContext
) => apiLogger.logDatabaseOperation(operation, dbCall, context);

/**
 * Create structured API responses
 */
export const createApiResponse = apiLogger.createResponse.bind(apiLogger);
export const createErrorResponse = apiLogger.createErrorResponse.bind(apiLogger);
