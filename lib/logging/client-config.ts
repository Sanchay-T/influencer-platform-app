import { LogLevel } from './types';

export interface ClientLoggingConfig {
	minLevel: LogLevel;
	environment: string | undefined;
}

const LEVEL_MAP: Record<string, LogLevel> = {
	DEBUG: LogLevel.DEBUG,
	INFO: LogLevel.INFO,
	WARN: LogLevel.WARN,
	WARNING: LogLevel.WARN,
	ERROR: LogLevel.ERROR,
	CRITICAL: LogLevel.CRITICAL,
	FATAL: LogLevel.CRITICAL,
};

let cachedConfig: ClientLoggingConfig | null = null;

function parseLevel(rawLevel: string | undefined, fallback: LogLevel): LogLevel {
	if (!rawLevel) return fallback;
	const normalized = rawLevel.trim().toUpperCase();
	return LEVEL_MAP[normalized] ?? fallback;
}

export function getClientLoggingConfig(): ClientLoggingConfig {
	if (cachedConfig) {
		return cachedConfig;
	}

	const env = process.env.NEXT_PUBLIC_CLIENT_LOG_LEVEL;
	const defaultLevel = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO;

	cachedConfig = {
		minLevel: parseLevel(env, defaultLevel),
		environment: process.env.NODE_ENV,
	};

	return cachedConfig;
}

export function shouldEmitClientLog(level: LogLevel): boolean {
	const { minLevel } = getClientLoggingConfig();
	return level >= minLevel;
}

export function resetClientLoggingConfigCache(): void {
	cachedConfig = null;
}
