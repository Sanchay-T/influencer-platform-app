'use server';

import { logger } from './logger';
import { LogCategory, LogLevel } from './types';

const BRIDGE_KEY = '__loggingServerConsoleBridge__';
let stdoutFiltered = false;

declare global {
	var __loggingServerConsoleBridge__: boolean | undefined;
}

if (!globalThis.__loggingServerConsoleBridge__) {
	globalThis.__loggingServerConsoleBridge__ = true;

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
		(...args: unknown[]) => {
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
		if (!stdoutFiltered) {
			stdoutFiltered = true;
			const originalWrite = process.stdout.write.bind(process.stdout);
			const accessLogPattern = /^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//;

			const overrideWrite = (
				chunk: string | Uint8Array,
				encodingOrCallback?: BufferEncoding | ((err?: Error) => void),
				callback?: (err?: Error) => void
			): boolean => {
				const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined;
				const resolvedCallback =
					typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
				const text =
					typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(encoding ?? 'utf8');

				if (text && accessLogPattern.test(text)) {
					if (resolvedCallback) {
						resolvedCallback();
					}
					return true;
				}

				if (typeof encodingOrCallback === 'function') {
					return originalWrite(chunk, encodingOrCallback);
				}

				if (encoding) {
					return originalWrite(chunk, encoding, resolvedCallback);
				}

				return originalWrite(chunk, resolvedCallback);
			};

			process.stdout.write = overrideWrite;
		}
	}
}
