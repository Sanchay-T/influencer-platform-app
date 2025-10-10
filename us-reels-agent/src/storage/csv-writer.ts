import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export interface ReelRow {
    url: string;
    keyword: string;
    owner_handle?: string;
    owner_name?: string;
    caption?: string;
    transcript?: string;
    views?: number;
    thumbnail?: string;
    location_name?: string;
    us_decision?: 'US' | 'NotUS' | 'Unknown';
    relevance_decision?: 'match' | 'partial' | 'no';
    discovered_at?: string;
    updated_at?: string;
    status?: string;
}

const CSV_HEADERS = [
    'url',
    'keyword',
    'owner_handle',
    'owner_name',
    'caption',
    'transcript',
    'views',
    'thumbnail',
    'location_name',
    'us_decision',
    'relevance_decision',
    'discovered_at',
    'updated_at',
    'status'
];

/**
 * Initialize session CSV with headers
 */
export function initializeSessionCsv(csvPath: string): void {
    const content = stringify([CSV_HEADERS]);
    writeFileSync(csvPath, content);
}

/**
 * Read CSV file and return rows as objects
 */
function readCsv(csvPath: string): ReelRow[] {
    if (!existsSync(csvPath)) {
        return [];
    }
    const content = readFileSync(csvPath, 'utf-8');
    if (content.trim() === '' || content.trim() === CSV_HEADERS.join(',')) {
        return [];
    }
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, context) => {
            // Cast views to number
            if (context.column === 'views' && value) {
                return Number(value);
            }
            return value;
        }
    });
    return records;
}

/**
 * Write rows to CSV
 */
function writeCsv(csvPath: string, rows: ReelRow[]): void {
    const content = stringify(rows, {
        header: true,
        columns: CSV_HEADERS
    });
    writeFileSync(csvPath, content);
}

/**
 * Append URLs to CSV (initial discovery)
 */
export function appendUrls(csvPath: string, urls: string[], keyword: string): void {
    // Initialize if doesn't exist
    if (!existsSync(csvPath)) {
        initializeSessionCsv(csvPath);
    }

    const rows = readCsv(csvPath);
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
        writeCsv(csvPath, [...rows, ...newRows]);
    }
}

/**
 * Update rows with post data
 */
export function updatePostData(csvPath: string, posts: any[]): void {
    const rows = readCsv(csvPath);
    const postMap = new Map(posts.map(p => [p.url, p]));
    const now = new Date().toISOString();

    const updated = rows.map(row => {
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
    });

    writeCsv(csvPath, updated);
}

/**
 * Update rows with transcript data
 */
export function updateTranscripts(csvPath: string, transcripts: any[]): void {
    const rows = readCsv(csvPath);
    const transcriptMap = new Map(transcripts.map(t => [t.url, t]));
    const now = new Date().toISOString();

    const updated = rows.map(row => {
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
    });

    writeCsv(csvPath, updated);
}

/**
 * Update rows with profile data (US decision)
 */
export function updateProfiles(csvPath: string, profiles: any[], usDecisions: Map<string, 'US' | 'NotUS' | 'Unknown'>): void {
    const rows = readCsv(csvPath);
    const now = new Date().toISOString();

    const updated = rows.map(row => {
        if (row.owner_handle && usDecisions.has(row.owner_handle)) {
            return {
                ...row,
                us_decision: usDecisions.get(row.owner_handle),
                updated_at: now
            };
        }
        return row;
    });

    writeCsv(csvPath, updated);
}

/**
 * Mark URLs as relevant
 */
export function markAsRelevant(csvPath: string, urls: string[]): void {
    const rows = readCsv(csvPath);
    const urlSet = new Set(urls);
    const now = new Date().toISOString();

    const updated = rows.map(row => {
        if (urlSet.has(row.url)) {
            return { ...row, relevance_decision: 'match' as const, updated_at: now };
        }
        return row;
    });

    writeCsv(csvPath, updated);
}

/**
 * Mark URLs as irrelevant
 */
export function markAsIrrelevant(csvPath: string, urls: string[]): void {
    const rows = readCsv(csvPath);
    const urlSet = new Set(urls);
    const now = new Date().toISOString();

    const updated = rows.map(row => {
        if (urlSet.has(row.url)) {
            return { ...row, relevance_decision: 'no' as const, updated_at: now };
        }
        return row;
    });

    writeCsv(csvPath, updated);
}
