import { readSessionCsv } from './csv-reader.js';
import { ReelRow } from './csv-writer.js';

/**
 * JavaScript-based CSV analysis tool (replaces pandas)
 * Provides data analysis capabilities without Python dependency
 */

export interface AnalysisResult {
    output: string;
    error?: string;
}

/**
 * Analyze session CSV data using JavaScript
 * Supports common operations like filtering, counting, aggregating
 */
export function analyzeSessionData(csvPath: string, operation: string): AnalysisResult {
    try {
        const rows = readSessionCsv(csvPath);

        // Parse the operation and execute
        const result = executeOperation(rows, operation);

        return {
            output: result,
            error: undefined
        };
    } catch (error: any) {
        return {
            output: '',
            error: error.message
        };
    }
}

/**
 * Execute analysis operation on CSV data
 */
function executeOperation(rows: ReelRow[], operation: string): string {
    const op = operation.toLowerCase().trim();

    // Count operations
    if (op.includes('count') || op.includes('how many')) {
        return handleCountOperation(rows, op);
    }

    // Filter operations
    if (op.includes('filter') || op.includes('show') || op.includes('list')) {
        return handleFilterOperation(rows, op);
    }

    // Summary statistics
    if (op.includes('summary') || op.includes('stats') || op.includes('overview')) {
        return handleSummaryOperation(rows);
    }

    // Sample data
    if (op.includes('sample') || op.includes('example')) {
        return handleSampleOperation(rows, op);
    }

    // Default: return basic stats
    return handleSummaryOperation(rows);
}

/**
 * Handle counting operations
 */
function handleCountOperation(rows: ReelRow[], operation: string): string {
    let results: string[] = [];

    results.push(`Total rows: ${rows.length}`);

    // Count with captions
    if (operation.includes('caption')) {
        const withCaptions = rows.filter(r => r.caption && r.caption.trim()).length;
        results.push(`With captions: ${withCaptions}`);
    }

    // Count with transcripts
    if (operation.includes('transcript')) {
        const withTranscripts = rows.filter(r => r.transcript && r.transcript.trim()).length;
        results.push(`With transcripts: ${withTranscripts}`);
    }

    // Count by keyword match
    if (operation.includes('fitness') || operation.includes('keyword')) {
        const keyword = 'fitness'; // Extract from operation or use default
        const inCaption = rows.filter(r =>
            r.caption?.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        const inTranscript = rows.filter(r =>
            r.transcript?.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        results.push(`Keyword "${keyword}" in caption: ${inCaption}`);
        results.push(`Keyword "${keyword}" in transcript: ${inTranscript}`);
    }

    // Count by status
    if (operation.includes('status')) {
        const statusCounts: Record<string, number> = {};
        rows.forEach(r => {
            const status = r.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        results.push('Status breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            results.push(`  ${status}: ${count}`);
        });
    }

    // Count unique creators
    if (operation.includes('creator') || operation.includes('handle') || operation.includes('owner')) {
        const uniqueHandles = new Set(rows.map(r => r.owner_handle).filter(h => !!h));
        results.push(`Unique creators: ${uniqueHandles.size}`);
    }

    return results.join('\n');
}

/**
 * Handle filter operations
 */
function handleFilterOperation(rows: ReelRow[], operation: string): string {
    let filtered = rows;

    // Filter by keyword in caption/transcript
    if (operation.includes('fitness') || operation.includes('relevant')) {
        const keyword = 'fitness';
        filtered = filtered.filter(r =>
            r.caption?.toLowerCase().includes(keyword.toLowerCase()) ||
            r.transcript?.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    // Filter by status
    if (operation.includes('hydrated')) {
        filtered = filtered.filter(r => r.status === 'hydrated' || r.status === 'transcript_fetched');
    }

    if (operation.includes('pending')) {
        filtered = filtered.filter(r => r.status === 'pending');
    }

    // Filter with transcripts
    if (operation.includes('transcript')) {
        filtered = filtered.filter(r => r.transcript && r.transcript.trim());
    }

    // Show results
    const limit = 5;
    const results: string[] = [];
    results.push(`Filtered results: ${filtered.length} rows`);
    results.push(`\nShowing first ${Math.min(limit, filtered.length)}:`);

    filtered.slice(0, limit).forEach((row, i) => {
        results.push(`\n${i + 1}. ${row.url}`);
        if (row.owner_handle) results.push(`   Owner: ${row.owner_handle}`);
        if (row.caption) results.push(`   Caption: ${row.caption.substring(0, 100)}...`);
        if (row.transcript) results.push(`   Transcript: ${row.transcript.substring(0, 100)}...`);
    });

    return results.join('\n');
}

/**
 * Handle summary operations
 */
function handleSummaryOperation(rows: ReelRow[]): string {
    const results: string[] = [];

    results.push(`=== Session Summary ===`);
    results.push(`Total rows: ${rows.length}`);

    const withCaptions = rows.filter(r => r.caption && r.caption.trim()).length;
    const withTranscripts = rows.filter(r => r.transcript && r.transcript.trim()).length;
    const hydrated = rows.filter(r => r.owner_handle).length;
    const pending = rows.filter(r => r.status === 'pending').length;

    results.push(`Hydrated: ${hydrated}`);
    results.push(`Pending: ${pending}`);
    results.push(`With captions: ${withCaptions}`);
    results.push(`With transcripts: ${withTranscripts}`);

    const uniqueHandles = new Set(rows.map(r => r.owner_handle).filter(h => !!h));
    results.push(`Unique creators: ${uniqueHandles.size}`);

    // Check keyword relevance
    const keyword = rows[0]?.keyword || 'fitness';
    const relevantInCaption = rows.filter(r =>
        r.caption?.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    const relevantInTranscript = rows.filter(r =>
        r.transcript?.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    results.push(`\nKeyword "${keyword}" matches:`);
    results.push(`  In captions: ${relevantInCaption}`);
    results.push(`  In transcripts: ${relevantInTranscript}`);

    return results.join('\n');
}

/**
 * Handle sample operations
 */
function handleSampleOperation(rows: ReelRow[], operation: string): string {
    const limit = 3;
    const results: string[] = [];

    results.push(`Sample data (${Math.min(limit, rows.length)} rows):\n`);

    rows.slice(0, limit).forEach((row, i) => {
        results.push(`--- Row ${i + 1} ---`);
        results.push(`URL: ${row.url}`);
        results.push(`Keyword: ${row.keyword}`);
        results.push(`Owner: ${row.owner_handle || 'N/A'}`);
        results.push(`Status: ${row.status || 'N/A'}`);
        results.push(`Caption: ${row.caption ? row.caption.substring(0, 80) + '...' : 'N/A'}`);
        results.push(`Transcript: ${row.transcript ? row.transcript.substring(0, 80) + '...' : 'N/A'}`);
        results.push('');
    });

    return results.join('\n');
}
