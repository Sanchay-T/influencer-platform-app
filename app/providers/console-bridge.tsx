'use client';

import { useEffect } from 'react';
import { emitClientLog } from '@/lib/logging/react/helpers';
import { LogCategory, LogLevel } from '@/lib/logging/types';

declare global {
	interface Window {
		clientConsoleBridgeInstalled?: boolean;
	}
}

type ConsoleMethod = 'log' | 'info' | 'debug' | 'warn' | 'error' | 'trace';

function formatMessage(args: unknown[]): string {
	if (args.length === 0) {
		return 'Console log message';
	}

	const [first] = args;
	if (typeof first === 'string') {
		return first;
	}
	if (first instanceof Error) {
		return first.message;
	}
	try {
		return JSON.stringify(first);
	} catch (_error) {
		return String(first);
	}
}

function serializeArgs(args: unknown[]): unknown[] {
	return args.slice(1).map((value) => {
		if (value instanceof Error) {
			return {
				name: value.name,
				message: value.message,
				stack: value.stack,
			};
		}
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return value;
		}
		try {
			return JSON.parse(JSON.stringify(value));
		} catch (_error) {
			return String(value);
		}
	});
}

const methodToLevel: Record<string, LogLevel> = {
	log: LogLevel.INFO,
	info: LogLevel.INFO,
	debug: LogLevel.DEBUG,
	warn: LogLevel.WARN,
	error: LogLevel.ERROR,
	trace: LogLevel.DEBUG,
};

export function ClientConsoleBridge() {
	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		if (window.clientConsoleBridgeInstalled) {
			return;
		}

		window.clientConsoleBridgeInstalled = true;

		const nativeConsole = { ...window.console };

		const createProxy =
			(method: ConsoleMethod) =>
			(...args: unknown[]) => {
				const level = methodToLevel[String(method)] ?? LogLevel.INFO;
				const message = formatMessage(args);
				const contextArgs = serializeArgs(args);

				emitClientLog(
					level,
					() => message,
					() =>
						contextArgs.length > 0
							? {
									consoleArgs: contextArgs,
								}
							: undefined,
					LogCategory.UI,
					args.find((value) => value instanceof Error)
				);

				const allowNative =
					process.env.NEXT_PUBLIC_LOG_BRIDGE_PASSTHROUGH === 'true' ||
					process.env.NODE_ENV === 'development';

				if (allowNative) {
					const target = nativeConsole[method] || nativeConsole.log;
					if (typeof target === 'function') {
						target.apply(nativeConsole, args);
					}
				}
			};

		window.console = {
			...nativeConsole,
			log: createProxy('log'),
			info: createProxy('info'),
			debug: createProxy('debug'),
			warn: createProxy('warn'),
			error: createProxy('error'),
			trace: createProxy('trace'),
		};
	}, []);

	return null;
}
