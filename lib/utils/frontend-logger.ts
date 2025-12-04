import { emitClientLog } from '@/lib/logging/react/helpers';
import { LogCategory, type LogContext, LogLevel } from '@/lib/logging/types';

// Breadcrumb: frontend logging facade -> consumed by client instrumentation (AuthLogger, NavigationLogger, onboarding flows).

interface ExtendedLogContext extends LogContext {
	metadata?: Record<string, unknown>;
}

interface ApiCallOptions {
	method?: string;
	body?: any;
	headers?: Record<string, string>;
}

const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
const SESSION_START = Date.now();
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'authorization'];

function buildContext(
	base: LogContext | undefined,
	metadata?: Record<string, unknown>
): ExtendedLogContext {
	const context: ExtendedLogContext = { ...(base || {}) };
	context.sessionId = context.sessionId ?? SESSION_ID;

	if (metadata && Object.keys(metadata).length > 0) {
		context.metadata = {
			...(context.metadata || {}),
			...metadata,
		};
	}

	return context;
}

function sanitizePayload(payload: any): any {
	if (!payload || typeof payload !== 'object') return payload;
	const clone = Array.isArray(payload) ? [...payload] : { ...payload };

	Object.keys(clone).forEach((key) => {
		const value = clone[key];
		if (value && typeof value === 'object') {
			clone[key] = sanitizePayload(value);
			return;
		}

		if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field))) {
			clone[key] = '[REDACTED]';
		}
	});

	return clone;
}

class FrontendLogger {
	private static emit(
		level: LogLevel,
		message: string,
		category: LogCategory,
		context?: LogContext,
		metadata?: Record<string, unknown>,
		error?: unknown
	) {
		emitClientLog(
			level,
			() => message,
			() => buildContext(context, metadata),
			category,
			error instanceof Error ? error : undefined
		);
	}

	/**
	 * Log major step headers with optional context. Defaults to DEBUG so it is silent unless explicitly enabled.
	 */
	static logStepHeader(step: string, description: string, context?: LogContext) {
		const metadata = {
			step,
			description,
			sessionTimeMs: Date.now() - SESSION_START,
		};

		FrontendLogger.emit(LogLevel.DEBUG, `Step: ${step}`, LogCategory.UI, context, metadata);
	}

	static logUserAction(action: string, details: any, context?: LogContext) {
		FrontendLogger.emit(LogLevel.DEBUG, `User action: ${action}`, LogCategory.UI, context, {
			action,
			details: sanitizePayload(details),
		});
	}

	static logFormAction(formName: string, action: 'submit' | 'validation' | 'error', data: any) {
		FrontendLogger.emit(LogLevel.DEBUG, `Form ${action}: ${formName}`, LogCategory.UI, undefined, {
			formName,
			action,
			data: sanitizePayload(data),
		});
	}

	static async loggedApiCall(
		url: string,
		options: ApiCallOptions = {},
		context?: LogContext
	): Promise<any> {
		const method = options.method || 'GET';
		const start = Date.now();
		const requestId = `api_${start}_${Math.random().toString(36).substring(7)}`;

		try {
			const response = await fetch(url, {
				method,
				headers: {
					'Content-Type': 'application/json',
					...options.headers,
				},
				body: options.body ? JSON.stringify(options.body) : undefined,
			});

			const duration = Date.now() - start;
			const data = await response.json();

			FrontendLogger.emit(
				response.ok ? LogLevel.DEBUG : LogLevel.ERROR,
				`API ${response.ok ? 'success' : 'failure'}: ${method} ${url}`,
				LogCategory.API,
				context,
				{
					url,
					method,
					status: response.status,
					ok: response.ok,
					durationMs: duration,
					requestId,
					payload: options.body ? sanitizePayload(options.body) : undefined,
					response: sanitizePayload(data),
				},
				response.ok ? undefined : new Error(`Request failed with status ${response.status}`)
			);

			return {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				json: async () => data,
				data,
				_parsedData: data,
				_duration: duration,
				_requestId: requestId,
				raw: response,
			};
		} catch (error) {
			const duration = Date.now() - start;

			FrontendLogger.emit(
				LogLevel.ERROR,
				`API exception: ${method} ${url}`,
				LogCategory.API,
				context,
				{
					url,
					method,
					durationMs: duration,
					requestId,
				},
				error
			);

			throw error;
		}
	}

	static logNavigation(from: string, to: string, reason: string, context?: LogContext) {
		FrontendLogger.emit(LogLevel.DEBUG, `Navigation: ${reason}`, LogCategory.UI, context, {
			from,
			to,
			reason,
		});
	}

	static logAuth(event: 'login' | 'logout' | 'session_check' | 'user_loaded', data: any) {
		FrontendLogger.emit(
			LogLevel.DEBUG,
			`Auth event: ${event}`,
			LogCategory.AUTH,
			undefined,
			sanitizePayload({ ...data, event })
		);
	}

	static logSuccess(operation: string, result: any, context?: LogContext) {
		FrontendLogger.emit(LogLevel.DEBUG, `Success: ${operation}`, LogCategory.UI, context, {
			operation,
			result: sanitizePayload(result),
		});
	}

	static logError(operation: string, error: any, context?: LogContext) {
		const normalized =
			error instanceof Error
				? error
				: new Error(typeof error === 'string' ? error : 'Unknown error');

		FrontendLogger.emit(
			LogLevel.ERROR,
			`Error in ${operation}`,
			LogCategory.UI,
			context,
			{
				operation,
				message: normalized.message,
				name: normalized.name,
			},
			normalized
		);
	}

	static logEmailEvent(type: 'scheduled' | 'sent' | 'failed', emailType: string, details: any) {
		FrontendLogger.emit(
			LogLevel.DEBUG,
			`Email ${type}: ${emailType}`,
			LogCategory.EMAIL,
			undefined,
			{
				emailType,
				state: type,
				details: sanitizePayload(details),
			}
		);
	}

	static logTiming(operation: string, startTime: number, context?: LogContext) {
		const duration = Date.now() - startTime;

		FrontendLogger.emit(LogLevel.DEBUG, `Timing: ${operation}`, LogCategory.PERFORMANCE, context, {
			operation,
			durationMs: duration,
		});
	}

	static getSessionInfo() {
		if (typeof window === 'undefined') {
			return {
				sessionId: SESSION_ID,
				sessionStartTime: SESSION_START,
			};
		}

		return {
			sessionId: SESSION_ID,
			sessionStartTime: SESSION_START,
			sessionDuration: Date.now() - SESSION_START,
			url: window.location.href,
			userAgent: window.navigator.userAgent,
			timestamp: new Date().toISOString(),
		};
	}
}

// Export convenience bindings to preserve existing call sites
export const logStepHeader = FrontendLogger.logStepHeader.bind(FrontendLogger);
export const logUserAction = FrontendLogger.logUserAction.bind(FrontendLogger);
export const logFormAction = FrontendLogger.logFormAction.bind(FrontendLogger);
export const loggedApiCall = FrontendLogger.loggedApiCall.bind(FrontendLogger);
export const logNavigation = FrontendLogger.logNavigation.bind(FrontendLogger);
export const logAuth = FrontendLogger.logAuth.bind(FrontendLogger);
export const logSuccess = FrontendLogger.logSuccess.bind(FrontendLogger);
export const logError = FrontendLogger.logError.bind(FrontendLogger);
export const logEmailEvent = FrontendLogger.logEmailEvent.bind(FrontendLogger);
export const logTiming = FrontendLogger.logTiming.bind(FrontendLogger);
