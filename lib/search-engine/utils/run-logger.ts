import { promises as fs } from 'fs';
import path from 'path';

// Lightweight per-run debug logger for scraping jobs.
// Toggle with SEARCH_DEBUG_LOGS=1 (safe to leave off in prod). Files land under logs/runs/<platform>/<jobId>.log
const LOG_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  (process.env.SEARCH_DEBUG_LOGS ?? '').toLowerCase(),
);

export type RunLogger = {
  log: (event: string, payload?: Record<string, any>) => Promise<void>;
  logTiming: (phase: string, durationMs: number, payload?: Record<string, any>) => Promise<void>;
  filePath: string;
  enabled: boolean;
  startTime: number;
};

export interface RunLoggerContext {
  userId?: string;
  userEmail?: string;
  keywords?: string[];
  targetResults?: number;
}

export function createRunLogger(platform: string, jobId?: string, context?: RunLoggerContext): RunLogger {
  const platformDir = platform.toLowerCase();
  const targetJobId = jobId || 'unknown-job';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const directory = path.join(process.cwd(), 'logs', 'runs', platformDir);
  // Include timestamp in filename for easy sorting
  const filePath = path.join(directory, `${timestamp}_${targetJobId}.log`);
  const startTime = Date.now();

  const log = async (event: string, payload: Record<string, any> = {}) => {
    if (!LOG_ENABLED) return;
    try {
      await fs.mkdir(directory, { recursive: true });
      const elapsed = Date.now() - startTime;
      const entry = {
        ts: new Date().toISOString(),
        elapsed: `${elapsed}ms`,
        platform: platformDir,
        jobId: targetJobId,
        ...(context?.userId && { userId: context.userId }),
        ...(context?.userEmail && { userEmail: context.userEmail }),
        event,
        ...payload,
      };
      await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      // Swallow logging errors to avoid impacting the main flow
    }
  };

  const logTiming = async (phase: string, durationMs: number, payload: Record<string, any> = {}) => {
    await log(`timing_${phase}`, { durationMs, ...payload });
  };

  return {
    log,
    logTiming,
    filePath,
    enabled: LOG_ENABLED,
    startTime,
  };
}

export const RUN_LOGGING_ENABLED = LOG_ENABLED;
