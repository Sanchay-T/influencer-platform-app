import { log } from '../utils/logger.js';
import {
    initializeSession,
    resetSessionRows,
    getSessionMetadata as storeGetSessionMetadata,
    patchSessionMetadata,
    finalizeSession as storeFinalizeSession,
    setCostSummary,
} from './session-store.js';
import type { SessionMetadata } from './types.js';

export interface SessionContext {
    sessionId: string;
    sessionPath: string;
    sessionCsv: string;
    metadataPath: string;
    keyword: string;
}

function generateSessionId(keyword: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const safeKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
    return `${safeKeyword}_${timestamp}`;
}

/**
 * Create a new session for the given keyword
 */
export function createSession(keyword: string): SessionContext {
    const sessionId = generateSessionId(keyword);
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

    initializeSession(sessionId, metadata);
    resetSessionRows(sessionId);

    log.info('[US_REELS][SESSION_MANAGER] Initialized in-memory session store', sessionId);

    return {
        sessionId,
        sessionPath: sessionId,
        sessionCsv: sessionId,
        metadataPath: sessionId,
        keyword
    };
}

/**
 * Get session metadata
 */
export function getSessionMetadata(metadataPath: string): SessionMetadata {
    return storeGetSessionMetadata(metadataPath);
}

/**
 * Update session metadata
 */
export function updateSessionMetadata(metadataPath: string, updates: Partial<SessionMetadata>): void {
    patchSessionMetadata(metadataPath, updates);
}

/**
 * Finalize session (mark as complete)
 */
export function finalizeSession(metadataPath: string, success: boolean = true): void {
    storeFinalizeSession(metadataPath, success);
}

export function writeCostSummary(sessionPath: string, summary: unknown): void {
    setCostSummary(sessionPath, summary);
}
