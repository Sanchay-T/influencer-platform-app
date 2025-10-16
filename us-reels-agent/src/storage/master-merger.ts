import { readSessionCsv } from './csv-reader.js';
import type { ReelRow } from './types.js';
import { log } from '../utils/logger.js';

const masterRowsMap = new Map<string, ReelRow>();

function readMasterCsv(): ReelRow[] {
    return Array.from(masterRowsMap.values()).map(row => ({ ...row }));
}

function writeMasterCsv(rows: ReelRow[]): void {
    masterRowsMap.clear();
    for (const row of rows) {
        masterRowsMap.set(row.url, { ...row });
    }
    log.info(`[US_REELS][MASTER_MERGER] Master dataset updated in memory (${rows.length} rows)`);
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
