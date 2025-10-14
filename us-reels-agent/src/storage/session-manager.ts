import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';

export interface SessionContext {
    sessionId: string;
    sessionPath: string;
    sessionCsv: string;
    metadataPath: string;
    keyword: string;
}

export interface SessionMetadata {
    sessionId: string;
    keyword: string;
    startTime: string;
    endTime?: string;
    totalUrls: number;
    totalProcessed: number;
    totalRelevant: number;
    totalUS: number;
    status: 'running' | 'completed' | 'failed';
}

function resolveDataRoot(): string {
    const override = process.env.US_REELS_AGENT_DATA_DIR;
    if (override && typeof override === 'string') {
        return isAbsolute(override) ? override : resolve(process.cwd(), override);
    }
    return resolve(process.cwd(), 'data');
}

const DATA_DIR = resolveDataRoot();
const SESSIONS_DIR = join(DATA_DIR, 'sessions');

/**
 * Create a new session for the given keyword
 */
export function createSession(keyword: string): SessionContext {
    // Ensure data directories exist
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!existsSync(SESSIONS_DIR)) {
        mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    // Create session ID: keyword_timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const safekeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
    const sessionId = `${safekeyword}_${timestamp}`;

    // Create session directory
    const sessionPath = join(SESSIONS_DIR, sessionId);
    mkdirSync(sessionPath, { recursive: true });

    const sessionCsv = join(sessionPath, 'session.csv');
    const metadataPath = join(sessionPath, 'metadata.json');

    // Initialize metadata
    const metadata: SessionMetadata = {
        sessionId,
        keyword,
        startTime: new Date().toISOString(),
        totalUrls: 0,
        totalProcessed: 0,
        totalRelevant: 0,
        totalUS: 0,
        status: 'running'
    };
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    return {
        sessionId,
        sessionPath,
        sessionCsv,
        metadataPath,
        keyword
    };
}

/**
 * Get session metadata
 */
export function getSessionMetadata(metadataPath: string): SessionMetadata {
    const content = readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Update session metadata
 */
export function updateSessionMetadata(metadataPath: string, updates: Partial<SessionMetadata>): void {
    const metadata = getSessionMetadata(metadataPath);
    const updated = { ...metadata, ...updates };
    writeFileSync(metadataPath, JSON.stringify(updated, null, 2));
}

/**
 * Finalize session (mark as complete)
 */
export function finalizeSession(metadataPath: string, success: boolean = true): void {
    updateSessionMetadata(metadataPath, {
        endTime: new Date().toISOString(),
        status: success ? 'completed' : 'failed'
    });
}

export function writeCostSummary(sessionPath: string, summary: unknown): void {
    const filePath = join(sessionPath, 'cost-summary.json');
    writeFileSync(filePath, JSON.stringify(summary, null, 2));
}
