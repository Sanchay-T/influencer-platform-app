'use server';

/**
 * Server-side log writer utilities.
 *
 * This module is intentionally isolated behind a dynamic import from logger.ts
 * so that browser bundles never pull in Node-only dependencies like `fs`.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { FILE_LOGGING_CONFIG } from './constants';
import type { LogCategory, LogEntry } from './types';

type LogEnvironment = 'development' | 'test' | 'production' | string;

const ensuredDirectories = new Set<string>();

async function ensureDirectory(dir: string) {
	if (ensuredDirectories.has(dir)) {
		return;
	}
	await fs.mkdir(dir, { recursive: true });
	ensuredDirectories.add(dir);
}

function resolveLogFile(category: LogCategory, environment: LogEnvironment, date: Date) {
	const baseDir = path.join(FILE_LOGGING_CONFIG.LOG_DIRECTORY, environment);
	const pattern =
		FILE_LOGGING_CONFIG.FILE_PATTERNS[category] ?? FILE_LOGGING_CONFIG.FILE_PATTERNS.default;
	const formattedDate = date.toISOString().slice(0, 10);
	const fileName = pattern.replace('%DATE%', formattedDate);
	return path.join(baseDir, fileName);
}

export interface StructuredLogOptions {
	environment: LogEnvironment;
}

/**
 * Persist a structured JSON log entry to disk.
 * Files are daily-rotated and grouped by environment/category.
 */
export async function writeStructuredLog(
	entry: LogEntry,
	{ environment }: StructuredLogOptions
): Promise<void> {
	const now = new Date(entry.timestamp);
	const destination = resolveLogFile(entry.category, environment, now);
	await ensureDirectory(path.dirname(destination));
	const payload = JSON.stringify(entry);
	await fs.appendFile(destination, payload + '\n', 'utf8');
}
