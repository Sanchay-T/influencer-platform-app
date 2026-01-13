import { logger } from './logger';
import { type LogCategory, LogLevel } from './types';

type ConsoleMethod = (...args: unknown[]) => void;

function createProxy(level: LogLevel, category?: LogCategory): ConsoleMethod {
	return (...args: unknown[]) => {
		logger.captureConsole(level, args, category);
	};
}

export const structuredConsole = {
	log: createProxy(LogLevel.INFO),
	info: createProxy(LogLevel.INFO),
	debug: createProxy(LogLevel.DEBUG),
	warn: createProxy(LogLevel.WARN),
	error: createProxy(LogLevel.ERROR),
	trace: createProxy(LogLevel.DEBUG),
	dir: createProxy(LogLevel.INFO),
	table: createProxy(LogLevel.INFO),
	group: createProxy(LogLevel.INFO),
	groupCollapsed: createProxy(LogLevel.INFO),
	groupEnd: createProxy(LogLevel.INFO),
	time: createProxy(LogLevel.INFO),
	timeEnd: createProxy(LogLevel.INFO),
};

export type StructuredConsole = typeof structuredConsole;
