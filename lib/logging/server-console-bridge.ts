'use server';

import { logger } from './logger';
import { LogCategory, LogLevel } from './types';

const BRIDGE_SYMBOL = Symbol.for('logging.serverConsoleBridge');

if (!(globalThis as any)[BRIDGE_SYMBOL]) {
	(globalThis as any)[BRIDGE_SYMBOL] = true;

	const originalConsole: Console = {
		...globalThis.console,
	};

	logger.setNativeConsole(originalConsole);

	const methodToLevel: Record<string, LogLevel> = {
		log: LogLevel.INFO,
		info: LogLevel.INFO,
		debug: LogLevel.DEBUG,
		warn: LogLevel.WARN,
		error: LogLevel.ERROR,
		trace: LogLevel.DEBUG,
	};

	const createProxy =
		(method: keyof Console) =>
		(...args: any[]) => {
			const level = methodToLevel[String(method)] ?? LogLevel.INFO;
			logger.captureConsole(level, args, LogCategory.SYSTEM);
		};

	globalThis.console = {
		...originalConsole,
		log: createProxy('log'),
		info: createProxy('info'),
		debug: createProxy('debug'),
		warn: createProxy('warn'),
		error: createProxy('error'),
		trace: createProxy('trace'),
	};

	const shouldSuppressAccessLogs =
		(process.env.SERVER_SUPPRESS_ACCESS_LOGS ?? 'true').toLowerCase() !== 'false' &&
		process.env.NODE_ENV === 'development';

	if (shouldSuppressAccessLogs) {
		const stdoutSymbol = Symbol.for('logging.stdoutFiltered');
		if (!(process.stdout as any)[stdoutSymbol]) {
			(process.stdout as any)[stdoutSymbol] = true;

			const originalWrite = process.stdout.write.bind(process.stdout);
			const accessLogPattern = /^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//;

			process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
				const text = typeof chunk === 'string' ? chunk : chunk?.toString(encoding ?? 'utf8');

				if (text && accessLogPattern.test(text)) {
					if (typeof callback === 'function') {
						callback();
					}
					return true;
				}

				return originalWrite(chunk, encoding, callback);
			};
		}
	}
}
