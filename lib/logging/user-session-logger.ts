/**
 * User Session Logger
 *
 * Creates per-user log files for debugging signup/payment flows.
 * Logs are stored in: logs/users/{email}/
 *
 * Usage:
 *   const logger = new UserSessionLogger('user@example.com');
 *   logger.log('CLERK_WEBHOOK', 'User created', { userId: '123' });
 *   logger.log('STRIPE_WEBHOOK', 'Payment completed', { plan: 'glow_up' });
 */

import crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from './logger';
import { LogCategory } from './types';

const LOGS_BASE_DIR = path.join(process.cwd(), 'logs', 'users');
const ENABLE_SESSION_LOGS =
	process.env.ENABLE_SESSION_LOGS === 'true' ||
	(process.env.NODE_ENV !== 'production' && process.env.ENABLE_SESSION_LOGS !== 'false');

export interface LogEntry {
	timestamp: string;
	event: string;
	message: string;
	data?: unknown;
	source?: string;
}

export class UserSessionLogger {
	private enabled: boolean;
	private emailHash: string;
	private userId?: string;
	private userDir: string;
	private sessionFile: string;
	private sessionId: string;

	constructor(email: string, userId?: string) {
		this.enabled = ENABLE_SESSION_LOGS;
		this.emailHash = UserSessionLogger.hashEmail(email);
		this.userId = userId;
		this.sessionId = `session_${Date.now()}`;
		this.userDir = '';
		this.sessionFile = '';

		if (!this.enabled) {
			return;
		}

		// Create user directory
		this.userDir = path.join(LOGS_BASE_DIR, this.emailHash);
		this.ensureDir(this.userDir);

		// Session file with timestamp
		const date = new Date().toISOString().split('T')[0];
		this.sessionFile = path.join(this.userDir, `${date}_${this.sessionId}.json`);

		// Initialize session file
		this.initSession();
	}

	private ensureDir(dir: string): void {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	private initSession(): void {
		if (!this.enabled) {
			return;
		}

		const logs: LogEntry[] = [];
		const sessionData = {
			emailHash: this.emailHash,
			userId: this.userId,
			sessionId: this.sessionId,
			startedAt: new Date().toISOString(),
			logs,
		};

		fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));

		// Also append to master log for this user
		this.appendToMasterLog({
			timestamp: new Date().toISOString(),
			event: 'SESSION_START',
			message: `New session started: ${this.sessionId}`,
			data: { sessionFile: this.sessionFile },
		});
	}

	log(event: string, message: string, data?: unknown, source?: string): void {
		if (!this.enabled) {
			return;
		}

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			event,
			message,
			data,
			source,
		};

		// Append to session file
		this.appendToSessionFile(entry);

		// Append to master log
		this.appendToMasterLog(entry);

		logger.info(
			`[user:${this.emailHash.slice(0, 8)}] [${event}] ${message}`,
			{
				userId: this.userId,
				metadata: data ? { data, source } : { source },
			},
			LogCategory.ONBOARDING
		);
	}

	private appendToSessionFile(entry: LogEntry): void {
		if (!this.enabled) {
			return;
		}

		try {
			const content = JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
			content.logs.push(entry);
			content.lastUpdated = new Date().toISOString();
			fs.writeFileSync(this.sessionFile, JSON.stringify(content, null, 2));
		} catch (e) {
			logger.error(
				'Failed to append to session file',
				e instanceof Error ? e : new Error(String(e)),
				{ metadata: { sessionFile: this.sessionFile } },
				LogCategory.ONBOARDING
			);
		}
	}

	private appendToMasterLog(entry: LogEntry): void {
		if (!this.enabled) {
			return;
		}

		const masterLogFile = path.join(this.userDir, 'all_activity.jsonl');
		const line = `${JSON.stringify({ ...entry, sessionId: this.sessionId })}\n`;
		fs.appendFileSync(masterLogFile, line);
	}

	// Static method to get or create logger for a user
	static forUser(email: string, userId?: string): UserSessionLogger {
		return new UserSessionLogger(email, userId);
	}

	// Get all logs for a user
	static getUserLogs(email: string): { sessions: string[]; masterLog: LogEntry[] } {
		const emailHash = UserSessionLogger.hashEmail(email);
		const userDir = path.join(LOGS_BASE_DIR, emailHash);

		if (!fs.existsSync(userDir)) {
			return { sessions: [], masterLog: [] };
		}

		const sessions = fs
			.readdirSync(userDir)
			.filter((f) => f.endsWith('.json') && f !== 'all_activity.jsonl')
			.sort()
			.reverse();

		const masterLogFile = path.join(userDir, 'all_activity.jsonl');
		let masterLog: LogEntry[] = [];

		if (fs.existsSync(masterLogFile)) {
			const content = fs.readFileSync(masterLogFile, 'utf-8');
			masterLog = content
				.split('\n')
				.filter((line) => line.trim())
				.map((line) => JSON.parse(line));
		}

		return { sessions, masterLog };
	}

	static hashEmail(email: string): string {
		return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
	}

	// Print formatted logs for a user
	static printUserLogs(email: string): void {
		const { sessions, masterLog } = UserSessionLogger.getUserLogs(email);
		const logLine = (message: string) => {
			logger.info(message, undefined, LogCategory.SYSTEM);
		};

		logLine(`\n${'='.repeat(60)}`);
		logLine(`📋 LOGS FOR: ${email}`);
		logLine('='.repeat(60));

		if (masterLog.length === 0) {
			logLine('\n   No logs found for this user.\n');
			return;
		}

		logLine(`\n📁 Sessions: ${sessions.length}`);
		logLine(`📝 Total log entries: ${masterLog.length}\n`);

		// Group by event type
		const byEvent: Record<string, LogEntry[]> = {};
		for (const entry of masterLog) {
			if (!byEvent[entry.event]) {
				byEvent[entry.event] = [];
			}
			byEvent[entry.event].push(entry);
		}

		// Print timeline
		logLine('📅 TIMELINE:\n');
		for (const entry of masterLog) {
			const time = new Date(entry.timestamp).toLocaleTimeString();
			const icon = getEventIcon(entry.event);
			logLine(`   ${time} ${icon} [${entry.event}] ${entry.message}`);
			if (entry.data) {
				const dataStr = JSON.stringify(entry.data, null, 2)
					.split('\n')
					.map((line) => `            ${line}`)
					.join('\n');
				logLine(dataStr);
			}
		}

		logLine(`\n${'='.repeat(60)}\n`);
	}
}

function getEventIcon(event: string): string {
	const icons = new Map<string, string>([
		['SESSION_START', '🚀'],
		['CLERK_WEBHOOK', '👤'],
		['USER_CREATED', '✨'],
		['PLAN_SELECTED', '📋'],
		['STRIPE_CHECKOUT', '💳'],
		['STRIPE_WEBHOOK', '💰'],
		['PAYMENT_SUCCESS', '✅'],
		['PAYMENT_FAILED', '❌'],
		['ONBOARDING_COMPLETE', '🎉'],
		['TRIAL_STARTED', '⏱️'],
		['ERROR', '🚨'],
	]);
	return icons.get(event) ?? '📌';
}

// Export a singleton for the current request (will need middleware to set)
let currentLogger: UserSessionLogger | null = null;

export function setCurrentUserLogger(logger: UserSessionLogger): void {
	currentLogger = logger;
}

export function getCurrentUserLogger(): UserSessionLogger | null {
	return currentLogger;
}

export function logUserEvent(email: string, event: string, message: string, data?: unknown): void {
	const logger = UserSessionLogger.forUser(email);
	logger.log(event, message, data);
}

export default UserSessionLogger;
