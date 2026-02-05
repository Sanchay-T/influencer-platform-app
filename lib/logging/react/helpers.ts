import { getClientLoggingConfig, shouldEmitClientLog } from '../client-config';
import { logger } from '../logger';
import { type LogCategory, type LogContext, LogLevel } from '../types';

// Breadcrumb: react logging helpers -> consumed by hook modules -> aggregated in lib/logging/react-logger.ts for client bundles.

export interface ClientLogGates {
	debug: boolean;
	info: boolean;
	warn: boolean;
	error: boolean;
	critical: boolean;
}

export function getClientLogGates(): ClientLogGates {
	return {
		debug: shouldEmitClientLog(LogLevel.DEBUG),
		info: shouldEmitClientLog(LogLevel.INFO),
		warn: shouldEmitClientLog(LogLevel.WARN),
		error: shouldEmitClientLog(LogLevel.ERROR),
		critical: shouldEmitClientLog(LogLevel.CRITICAL),
	};
}

export function safeSerialize(value: unknown, maxLength = 200): string | undefined {
	if (value == null) {
		return undefined;
	}
	try {
		const serialized = JSON.stringify(value);
		return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}...` : serialized;
	} catch (_error) {
		return undefined;
	}
}

export function mergeContext(base: LogContext, additional?: LogContext): LogContext {
	return additional ? { ...base, ...additional } : base;
}

export function emitClientLog(
	level: LogLevel,
	getMessage: () => string,
	buildContext?: () => LogContext | undefined,
	category?: LogCategory,
	error?: Error
): void {
	if (!shouldEmitClientLog(level)) {
		return;
	}

	const context = buildContext?.();
	const message = getMessage();

	switch (level) {
		case LogLevel.DEBUG:
			logger.debug(message, context, category);
			break;
		case LogLevel.INFO:
			logger.info(message, context, category);
			break;
		case LogLevel.WARN:
			logger.warn(message, context, category);
			break;
		case LogLevel.ERROR:
			logger.error(message, error, context, category);
			break;
		case LogLevel.CRITICAL:
			logger.critical(message, error, context, category);
			break;
		default:
			break;
	}
}

export function describeClientLogging(): string {
	const { minLevel, environment } = getClientLoggingConfig();
	return `Client logging min level: ${LogLevel[minLevel]} (env: ${environment ?? 'unknown'})`;
}
