import { promises as fs } from 'fs';
import path from 'path';

// Lightweight per-run debug logger for scraping jobs.
// Toggle with SEARCH_DEBUG_LOGS=1 (safe to leave off in prod). Files land under logs/runs/<platform>/<jobId>.log
const LOG_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  (process.env.SEARCH_DEBUG_LOGS ?? '').toLowerCase(),
);

export type RunLogger = {
  log: (event: string, payload?: Record<string, any>) => Promise<void>;
  filePath: string;
  enabled: boolean;
};

export function createRunLogger(platform: string, jobId?: string): RunLogger {
  const platformDir = platform.toLowerCase();
  const targetJobId = jobId || 'unknown-job';
  const directory = path.join(process.cwd(), 'logs', 'runs', platformDir);
  const filePath = path.join(directory, `${targetJobId}.log`);

  const log = async (event: string, payload: Record<string, any> = {}) => {
    if (!LOG_ENABLED) return;
    try {
      await fs.mkdir(directory, { recursive: true });
      const entry = {
        ts: new Date().toISOString(),
        platform: platformDir,
        jobId: targetJobId,
        event,
        ...payload,
      };
      await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      // Swallow logging errors to avoid impacting the main flow
    }
  };

  return {
    log,
    filePath,
    enabled: LOG_ENABLED,
  };
}

export const RUN_LOGGING_ENABLED = LOG_ENABLED;
