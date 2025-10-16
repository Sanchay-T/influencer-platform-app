import { SessionMetadata, SessionState, ReelRow } from './types.js';

const sessions = new Map<string, SessionState>();

function cloneRows(rows: ReelRow[]): ReelRow[] {
    return rows.map(row => ({ ...row }));
}

function ensureSession(sessionId: string): SessionState {
    const session = sessions.get(sessionId);
    if (!session) {
        throw new Error(`US Reels session "${sessionId}" has not been initialized`);
    }
    return session;
}

export function initializeSession(sessionId: string, metadata: SessionMetadata): void {
    sessions.set(sessionId, {
        rows: [],
        metadata: { ...metadata },
        costSummary: undefined
    });
}

export function resetSessionRows(sessionId: string): void {
    const session = ensureSession(sessionId);
    session.rows = [];
}

export function getSessionRows(sessionId: string): ReelRow[] {
    return cloneRows(ensureSession(sessionId).rows);
}

export function setSessionRows(sessionId: string, rows: ReelRow[]): void {
    const session = ensureSession(sessionId);
    session.rows = cloneRows(rows);
}

export function upsertSessionRows(sessionId: string, mutator: (rows: ReelRow[]) => ReelRow[]): void {
    const session = ensureSession(sessionId);
    const nextRows = mutator(cloneRows(session.rows));
    session.rows = cloneRows(nextRows);
}

export function getSessionMetadata(sessionId: string): SessionMetadata {
    return { ...ensureSession(sessionId).metadata };
}

export function patchSessionMetadata(sessionId: string, updates: Partial<SessionMetadata>): void {
    const session = ensureSession(sessionId);
    session.metadata = { ...session.metadata, ...updates };
}

export function finalizeSession(sessionId: string, success: boolean): void {
    patchSessionMetadata(sessionId, {
        endTime: new Date().toISOString(),
        status: success ? 'completed' : 'failed'
    });
}

export function setCostSummary(sessionId: string, summary: unknown): void {
    const session = ensureSession(sessionId);
    session.costSummary = summary;
}

export function getCostSummary(sessionId: string): unknown {
    return ensureSession(sessionId).costSummary;
}

export function clearSession(sessionId: string): void {
    sessions.delete(sessionId);
}
