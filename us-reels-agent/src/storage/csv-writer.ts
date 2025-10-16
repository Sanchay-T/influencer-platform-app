import { getSessionRows, setSessionRows, upsertSessionRows } from './session-store.js';
import type { ReelRow } from './types.js';

export type { ReelRow } from './types.js';

/**
 * Initialize session store
 */
export function initializeSessionCsv(csvPath: string): void {
    setSessionRows(csvPath, []);
}

/**
 * Append URLs to CSV (initial discovery)
 */
export function appendUrls(csvPath: string, urls: string[], keyword: string): void {
    const rows = getSessionRows(csvPath);
    const existingUrls = new Set(rows.map(r => r.url));
    const now = new Date().toISOString();

    // Add only new URLs
    const newRows = urls
        .filter(url => !existingUrls.has(url))
        .map(url => ({
            url,
            keyword,
            discovered_at: now,
            updated_at: now,
            status: 'pending'
        }));

    if (newRows.length > 0) {
        setSessionRows(csvPath, [...rows, ...newRows]);
    }
}

/**
 * Update rows with post data
 */
export function updatePostData(csvPath: string, posts: any[]): void {
    const postMap = new Map(posts.map(p => [p.url, p]));
    const now = new Date().toISOString();

    upsertSessionRows(csvPath, (rows) => rows.map(row => {
        const post = postMap.get(row.url);
        if (post) {
            return {
                ...row,
                owner_handle: post.owner_handle || row.owner_handle,
                owner_name: post.owner_name || row.owner_name,
                caption: post.caption || row.caption,
                views: post.views ?? row.views,
                thumbnail: post.thumbnail || row.thumbnail,
                location_name: post.location_name || row.location_name,
                updated_at: now,
                status: 'hydrated'
            };
        }
        return row;
    }));
}

/**
 * Update rows with transcript data
 */
export function updateTranscripts(csvPath: string, transcripts: any[]): void {
    const transcriptMap = new Map(transcripts.map(t => [t.url, t]));
    const now = new Date().toISOString();

    upsertSessionRows(csvPath, (rows) => rows.map(row => {
        const transcript = transcriptMap.get(row.url);
        if (transcript) {
            return {
                ...row,
                transcript: transcript.transcript || row.transcript,
                updated_at: now,
                status: 'transcript_fetched'
            };
        }
        return row;
    }));
}

/**
 * Update rows with profile data (US decision)
 */
export function updateProfiles(csvPath: string, profiles: any[], usDecisions: Map<string, 'US' | 'NotUS' | 'Unknown'>): void {
    const now = new Date().toISOString();

    upsertSessionRows(csvPath, (rows) => rows.map(row => {
        if (row.owner_handle && usDecisions.has(row.owner_handle)) {
            return {
                ...row,
                us_decision: usDecisions.get(row.owner_handle),
                updated_at: now
            };
        }
        return row;
    }));
}

/**
 * Mark URLs as relevant
 */
export function markAsRelevant(csvPath: string, urls: string[]): void {
    const urlSet = new Set(urls);
    const now = new Date().toISOString();

    upsertSessionRows(csvPath, (rows) => rows.map(row => {
        if (urlSet.has(row.url)) {
            return { ...row, relevance_decision: 'match' as const, updated_at: now };
        }
        return row;
    }));
}

/**
 * Mark URLs as irrelevant
 */
export function markAsIrrelevant(csvPath: string, urls: string[]): void {
    const urlSet = new Set(urls);
    const now = new Date().toISOString();

    upsertSessionRows(csvPath, (rows) => rows.map(row => {
        if (urlSet.has(row.url)) {
            return { ...row, relevance_decision: 'no' as const, updated_at: now };
        }
        return row;
    }));
}
