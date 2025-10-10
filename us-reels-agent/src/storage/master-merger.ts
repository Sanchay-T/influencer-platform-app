import { existsSync, writeFileSync } from 'fs';
import { readSessionCsv } from './csv-reader.js';
import { ReelRow } from './csv-writer.js';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { log } from '../utils/logger.js';

const MASTER_CSV = 'data/master.csv';

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
 * Read master CSV
 */
function readMasterCsv(): ReelRow[] {
    if (!existsSync(MASTER_CSV)) {
        return [];
    }
    const content = readFileSync(MASTER_CSV, 'utf-8');
    if (content.trim() === '') {
        return [];
    }
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, context) => {
            if (context.column === 'views' && value) {
                return Number(value);
            }
            return value;
        }
    });
    return records;
}

/**
 * Write master CSV
 */
function writeMasterCsv(rows: ReelRow[]): void {
    const content = stringify(rows, {
        header: true,
        columns: CSV_HEADERS
    });
    writeFileSync(MASTER_CSV, content);
}

/**
 * Merge session CSV into master CSV
 *
 * Deduplication strategy:
 * - If URL exists in master, keep the one with newer updated_at
 * - Otherwise, append new row
 */
export async function mergeMaster(sessionCsvPath: string): Promise<void> {
    log.subsection('Merging Session to Master CSV');

    const sessionRows = readSessionCsv(sessionCsvPath);
    const masterRows = readMasterCsv();

    if (sessionRows.length === 0) {
        log.info('No rows in session CSV to merge');
        return;
    }

    // Create a map of URLs to rows from master
    const masterMap = new Map<string, ReelRow>();
    for (const row of masterRows) {
        masterMap.set(row.url, row);
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    // Merge session rows
    for (const sessionRow of sessionRows) {
        const masterRow = masterMap.get(sessionRow.url);

        if (!masterRow) {
            // New row - add it
            masterMap.set(sessionRow.url, sessionRow);
            added++;
        } else {
            // Exists - check which is newer
            const sessionUpdated = new Date(sessionRow.updated_at || sessionRow.discovered_at || 0);
            const masterUpdated = new Date(masterRow.updated_at || masterRow.discovered_at || 0);

            if (sessionUpdated > masterUpdated) {
                // Session row is newer - update
                masterMap.set(sessionRow.url, sessionRow);
                updated++;
            } else {
                // Master row is newer or same - skip
                skipped++;
            }
        }
    }

    // Write back to master
    const finalRows = Array.from(masterMap.values());
    writeMasterCsv(finalRows);

    log.data.summary('Merge Statistics', {
        'Session rows': sessionRows.length,
        'Master rows (before)': masterRows.length,
        'Master rows (after)': finalRows.length,
        'Added': added,
        'Updated': updated,
        'Skipped (duplicates)': skipped
    });

    log.success(`Master CSV updated: ${MASTER_CSV}`);
}
