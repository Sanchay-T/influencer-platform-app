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

import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const LOGS_BASE_DIR = path.join(process.cwd(), 'logs', 'users');

export interface LogEntry {
	timestamp: string;
	event: string;
	message: string;
	data?: unknown;
	source?: string;
}

export class UserSessionLogger {
	private emailHash: string;
	private userId?: string;
	private userDir: string;
	private sessionFile: string;
	private sessionId: string;

	constructor(email: string, userId?: string) {
		this.emailHash = UserSessionLogger.hashEmail(email);
		this.userId = userId;
		this.sessionId = `session_${Date.now()}`;

		// Create user directory
		this.userDir = path.join(LOGS_BASE_DIR, this.emailHash);
		this.ensureDir(this.userDir);

		// Session file with timestamp
		const date = new Date().toISOString().split('T')[0];
		this.sessionFile = path.join(this.userDir, `${date}_${this.sessionId}.json`);

		// Initialize session file
		this.initSession();
	}

	private sanitizeEmail(email: string): string {
		// Replace special chars for filesystem safety
		return email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
	}

	private ensureDir(dir: string): void {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	private initSession(): void {
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

		// Also log to console for real-time visibility
		const label = this.emailHash.slice(0, 8);
		console.log(`[user:${label}] [${event}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
	}

	private appendToSessionFile(entry: LogEntry): void {
		try {
			const content = JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
			content.logs.push(entry);
			content.lastUpdated = new Date().toISOString();
			fs.writeFileSync(this.sessionFile, JSON.stringify(content, null, 2));
		} catch (e) {
			console.error('Failed to append to session file:', e);
		}
	}

	private appendToMasterLog(entry: LogEntry): void {
		const masterLogFile = path.join(this.userDir, 'all_activity.jsonl');
		const line = JSON.stringify({ ...entry, sessionId: this.sessionId }) + '\n';
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

		console.log('\n' + '='.repeat(60));
		console.log(`📋 LOGS FOR: ${email}`);
		console.log('='.repeat(60));

		if (masterLog.length === 0) {
			console.log('\n   No logs found for this user.\n');
			return;
		}

		console.log(`\n📁 Sessions: ${sessions.length}`);
		console.log(`📝 Total log entries: ${masterLog.length}\n`);

		// Group by event type
		const byEvent: Record<string, LogEntry[]> = {};
		for (const entry of masterLog) {
			if (!byEvent[entry.event]) byEvent[entry.event] = [];
			byEvent[entry.event].push(entry);
		}

		// Print timeline
		console.log('📅 TIMELINE:\n');
		for (const entry of masterLog) {
			const time = new Date(entry.timestamp).toLocaleTimeString();
			const icon = getEventIcon(entry.event);
			console.log(`   ${time} ${icon} [${entry.event}] ${entry.message}`);
			if (entry.data) {
				const dataStr = JSON.stringify(entry.data, null, 2)
					.split('\n')
					.map((line) => '            ' + line)
					.join('\n');
				console.log(dataStr);
			}
		}

		console.log('\n' + '='.repeat(60) + '\n');
	}
}

function getEventIcon(event: string): string {
	const icons: Record<string, string> = {
		SESSION_START: '🚀',
		CLERK_WEBHOOK: '👤',
		USER_CREATED: '✨',
		PLAN_SELECTED: '📋',
		STRIPE_CHECKOUT: '💳',
		STRIPE_WEBHOOK: '💰',
		PAYMENT_SUCCESS: '✅',
		PAYMENT_FAILED: '❌',
		ONBOARDING_COMPLETE: '🎉',
		TRIAL_STARTED: '⏱️',
		ERROR: '🚨',
	};
	return icons[event] || '📌';
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
