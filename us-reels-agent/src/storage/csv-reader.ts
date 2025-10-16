import { getSessionRows } from './session-store.js';
import type { ReelRow } from './types.js';

/**
 * Read session CSV and return all rows
 */
export function readSessionCsv(csvPath: string): ReelRow[] {
    return getSessionRows(csvPath);
}

/**
 * Get statistics about session CSV
 */
export interface CsvStats {
    total: number;
    pending: number;
    hydrated: number;
    with_transcripts: number;
    with_captions: number;
    relevant: number;
    irrelevant: number;
    us: number;
    not_us: number;
    unknown: number;
}

export function getStats(csvPath: string): CsvStats {
    const rows = readSessionCsv(csvPath);

    return {
        total: rows.length,
        pending: rows.filter(r => r.status === 'pending').length,
        hydrated: rows.filter(r => r.status === 'hydrated' || r.status === 'transcript_fetched').length,
        with_transcripts: rows.filter(r => r.transcript && r.transcript.trim()).length,
        with_captions: rows.filter(r => r.caption && r.caption.trim()).length,
        relevant: rows.filter(r => r.relevance_decision === 'match').length,
        irrelevant: rows.filter(r => r.relevance_decision === 'no').length,
        us: rows.filter(r => r.us_decision === 'US').length,
        not_us: rows.filter(r => r.us_decision === 'NotUS').length,
        unknown: rows.filter(r => r.us_decision === 'Unknown' || !r.us_decision).length
    };
}

/**
 * Get URLs by status
 */
export function getUrlsByStatus(csvPath: string, status: string): string[] {
    const rows = readSessionCsv(csvPath);
    return rows.filter(r => r.status === status).map(r => r.url);
}

/**
 * Get unique owner handles
 */
export function getUniqueHandles(csvPath: string): string[] {
    const rows = readSessionCsv(csvPath);
    const handles = rows
        .map(r => r.owner_handle)
        .filter((h): h is string => !!h);
    return Array.from(new Set(handles));
}

/**
 * Check which URLs already exist in CSV
 */
export function checkDuplicates(csvPath: string, urls: string[]): { existing: string[], new: string[] } {
    const rows = readSessionCsv(csvPath);
    const existingUrls = new Set(rows.map(r => r.url));

    const existing: string[] = [];
    const newUrls: string[] = [];

    for (const url of urls) {
        if (existingUrls.has(url)) {
            existing.push(url);
        } else {
            newUrls.push(url);
        }
    }

    return { existing, new: newUrls };
}
