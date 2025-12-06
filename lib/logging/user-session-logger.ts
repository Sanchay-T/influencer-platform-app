/**
 * User Session Logger
 *
 * Creates per-user log files for debugging signup/payment flows.
 * Logs are stored in: logs/users/{email}/
 *
 * NOTE: In serverless environments (Vercel), file operations are skipped
 * and logs are only written to console. File logging only works locally.
 *
 * Usage:
 *   const logger = new UserSessionLogger('user@example.com');
 *   logger.log('CLERK_WEBHOOK', 'User created', { userId: '123' });
 *   logger.log('STRIPE_WEBHOOK', 'Payment completed', { plan: 'glow_up' });
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGS_BASE_DIR = path.join(process.cwd(), 'logs', 'users');

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY ||
  process.env.VERCEL_ENV
);

export interface LogEntry {
  timestamp: string;
  event: string;
  message: string;
  data?: any;
  source?: string;
}

export class UserSessionLogger {
  private email: string;
  private userId?: string;
  private userDir: string;
  private sessionFile: string;
  private sessionId: string;
  private fileLoggingEnabled: boolean;

  constructor(email: string, userId?: string) {
    this.email = this.sanitizeEmail(email);
    this.userId = userId;
    this.sessionId = `session_${Date.now()}`;
    this.fileLoggingEnabled = !isServerless;

    // Create user directory (only in non-serverless environments)
    this.userDir = path.join(LOGS_BASE_DIR, this.email);
    
    if (this.fileLoggingEnabled) {
      try {
        this.ensureDir(this.userDir);
      } catch (e) {
        // File system not writable, disable file logging
        this.fileLoggingEnabled = false;
        console.warn('[UserSessionLogger] File logging disabled - filesystem not writable');
      }
    }

    // Session file with timestamp
    const date = new Date().toISOString().split('T')[0];
    this.sessionFile = path.join(this.userDir, `${date}_${this.sessionId}.json`);

    // Initialize session file (only if file logging is enabled)
    if (this.fileLoggingEnabled) {
      this.initSession();
    }
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
    const sessionData = {
      email: this.email,
      userId: this.userId,
      sessionId: this.sessionId,
      startedAt: new Date().toISOString(),
      logs: [] as LogEntry[],
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

  log(event: string, message: string, data?: any, source?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      event,
      message,
      data,
      source,
    };

    // Append to session file (only if file logging is enabled)
    if (this.fileLoggingEnabled) {
      this.appendToSessionFile(entry);
      this.appendToMasterLog(entry);
    }

    // Always log to console for real-time visibility
    console.log(`[${this.email}] [${event}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
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
    const sanitizedEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    const userDir = path.join(LOGS_BASE_DIR, sanitizedEmail);

    if (!fs.existsSync(userDir)) {
      return { sessions: [], masterLog: [] };
    }

    const sessions = fs.readdirSync(userDir)
      .filter(f => f.endsWith('.json') && f !== 'all_activity.jsonl')
      .sort()
      .reverse();

    const masterLogFile = path.join(userDir, 'all_activity.jsonl');
    let masterLog: LogEntry[] = [];

    if (fs.existsSync(masterLogFile)) {
      const content = fs.readFileSync(masterLogFile, 'utf-8');
      masterLog = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    }

    return { sessions, masterLog };
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
          .map(line => '            ' + line)
          .join('\n');
        console.log(dataStr);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

function getEventIcon(event: string): string {
  const icons: Record<string, string> = {
    'SESSION_START': '🚀',
    'CLERK_WEBHOOK': '👤',
    'USER_CREATED': '✨',
    'PLAN_SELECTED': '📋',
    'STRIPE_CHECKOUT': '💳',
    'STRIPE_WEBHOOK': '💰',
    'PAYMENT_SUCCESS': '✅',
    'PAYMENT_FAILED': '❌',
    'ONBOARDING_COMPLETE': '🎉',
    'TRIAL_STARTED': '⏱️',
    'ERROR': '🚨',
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

export function logUserEvent(email: string, event: string, message: string, data?: any): void {
  const logger = UserSessionLogger.forUser(email);
  logger.log(event, message, data);
}

export default UserSessionLogger;
