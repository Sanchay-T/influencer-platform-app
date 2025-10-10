import OpenAI from 'openai';
import { CFG } from '../config.js';
import { buildMessages } from './prompt.js';
import { toolSchemas } from './tools.js';
import { executeToolCall } from './router.js';
import { SearchResultSchema } from './schema.js';
import { log } from '../utils/logger.js';
import * as SessionManager from '../storage/session-manager.js';
import * as CsvReader from '../storage/csv-reader.js';
import * as CsvWriter from '../storage/csv-writer.js';
import { mergeMaster } from '../storage/master-merger.js';

const client = new OpenAI({ apiKey: CFG.OPENAI_API_KEY });

export async function runAgent(keyword: string) {
    log.section(`🚀 US Reels Agent - Keyword: "${keyword}"`);
    log.info(`Model: ${CFG.MODEL}`);
    log.info(`Max Results: ${CFG.MAX_RESULTS} | Per Creator Cap: ${CFG.PER_CREATOR_CAP}`);
    log.info(`Transcripts: ${CFG.TRANSCRIPTS}`);

    // Create session
    const sessionContext = SessionManager.createSession(keyword);
    log.session.start(sessionContext.sessionId, sessionContext.sessionPath);

    // Initialize session CSV
    CsvWriter.initializeSessionCsv(sessionContext.sessionCsv);

    // Keep track of the conversation input messages
    let currentInput = buildMessages(keyword, sessionContext);

    log.subsection('Initial API Request');
    const requestStart = Date.now();
    let resp = await client.responses.create({
        model: CFG.MODEL,
        input: currentInput,
        tools: toolSchemas,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        text: {
            format: {
                type: 'json_schema',
                name: 'USReelsSearchResult',
                schema: SearchResultSchema.json_schema.schema
            }
        },
        temperature: 0
    });

    log.success(`Response received in ${Date.now() - requestStart}ms (ID: ${resp.id})`);

    let iterationCount = 0;
    const MAX_ITERATIONS = 10;

    // In Responses API, function calls appear in output with type="function_call"
    while (iterationCount < MAX_ITERATIONS) {
        // Extract function calls from the output
        const functionCalls = (resp.output || []).filter((item: any) => item.type === 'function_call');

        if (functionCalls.length === 0) {
            log.success('No more function calls - Agent loop complete');
            break;
        }

        iterationCount++;
        log.iteration(iterationCount, MAX_ITERATIONS, functionCalls.length);

        functionCalls.forEach((fc: any, i: number) => {
            const argsPreview = fc.arguments?.substring(0, 80).replace(/\n/g, ' ') || '{}';
            log.info(`Tool ${i + 1}: ${fc.name}(${argsPreview}...)`);
        });

        // Execute all function calls
        const executionStart = Date.now();
        const functionResults = await Promise.all(functionCalls.map(async (fc: any) => {
            const call = {
                function: {
                    name: fc.name,
                    arguments: fc.arguments
                }
            };
            const result = await executeToolCall(call, sessionContext);  // Pass session context
            return {
                call_id: fc.call_id,
                name: fc.name,
                output: JSON.stringify(result)
            };
        }));

        log.success(`All tools executed in ${Date.now() - executionStart}ms`);

        // Append function call outputs to the input array
        // THIS IS THE KEY: Use type='function_call_output' with call_id
        functionResults.forEach((fr: any) => {
            currentInput.push({
                type: 'function_call_output',
                call_id: fr.call_id,
                output: fr.output
            } as any);
        });

        log.info(`Sending continuation request (${currentInput.length} messages in context)`);

        // Continue the conversation with previous_response_id and updated input
        const contStart = Date.now();
        resp = await client.responses.create({
            model: CFG.MODEL,
            previous_response_id: resp.id,
            input: currentInput,
            tools: toolSchemas,
            tool_choice: 'auto',
            parallel_tool_calls: true,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'USReelsSearchResult',
                    schema: SearchResultSchema.json_schema.schema
                }
            },
            temperature: 0
        });

        log.success(`Continuation response received in ${Date.now() - contStart}ms`);
    }

    log.section(`Agent Loop Complete - ${iterationCount} iteration(s)`);

    // Read final results from session CSV (source of truth)
    log.subsection('Reading Results from Session CSV');
    const allReels = CsvReader.readSessionCsv(sessionContext.sessionCsv);
    log.info(`Session CSV contains ${allReels.length} reels`);

    // Get AI's final JSON output for US decisions
    const text = (resp.output || [])
        .flatMap((o: any) => o?.content || [])
        .filter((c: any) => c.type === 'output_text')
        .map((c: any) => c.text)
        .join('');

    let json: any = {};
    try {
        json = JSON.parse(text);
        log.success(`AI output parsed successfully`);
    } catch (e) {
        log.warn(`JSON parse failed: ${e}`);
        json = { keyword, results: [] };
    }

    // Update CSV with AI's US decisions
    if (json.results && json.results.length > 0) {
        const usDecisions = new Map<string, 'US' | 'NotUS' | 'Unknown'>();
        for (const result of json.results) {
            if (result.owner_handle && result.us_decision) {
                usDecisions.set(result.owner_handle, result.us_decision);
            }
        }
        if (usDecisions.size > 0) {
            CsvWriter.updateProfiles(sessionContext.sessionCsv, [], usDecisions);
            log.storage.update('US decisions', usDecisions.size);
        }
    }

    // Re-read CSV with updated decisions
    const finalReels = CsvReader.readSessionCsv(sessionContext.sessionCsv);

    // Filter: US-only + per-creator cap
    log.subsection('Applying Filters');

    const beforeUSFilter = finalReels;
    // Accept both "US" and "Unknown" since Serper already filtered to US content
    const afterUSFilter = finalReels.filter(r =>
        r.us_decision === 'US' || r.us_decision === 'Unknown' || !r.us_decision
    );
    log.data.filter(beforeUSFilter.length, afterUSFilter.length, 'US-only filter (us_decision === "US" or "Unknown")');

    const cap = CFG.PER_CREATOR_CAP;
    const seen: Record<string, number> = {};
    const beforeCapFilter = afterUSFilter.length;
    const filtered = afterUSFilter
        .filter(r => {
            const h = r.owner_handle || '_';
            seen[h] = (seen[h] || 0) + 1;
            return seen[h] <= cap;
        })
        .slice(0, CFG.MAX_RESULTS);

    log.data.filter(beforeCapFilter, filtered.length, `Per-creator cap (max ${cap} per handle)`);

    // Statistics
    const stats = CsvReader.getStats(sessionContext.sessionCsv);
    log.data.summary('Session Statistics', {
        'Total reels collected': stats.total,
        'With captions': stats.with_captions,
        'With transcripts': stats.with_transcripts,
        'US reels': stats.us,
        'Non-US': stats.not_us,
        'Unknown': stats.unknown,
        'Final results (after filters)': filtered.length
    });

    // Finalize session
    SessionManager.updateSessionMetadata(sessionContext.metadataPath, {
        totalUrls: stats.total,
        totalProcessed: stats.total,
        totalRelevant: filtered.length,
        totalUS: stats.us
    });
    SessionManager.finalizeSession(sessionContext.metadataPath, true);
    log.session.end(sessionContext.sessionId, filtered.length);

    // Merge to master CSV
    const shouldMerge =
        process.env.US_REELS_DISABLE_MASTER_MERGE !== '1' &&
        process.env.NODE_ENV !== 'production';

    if (shouldMerge) {
        await mergeMaster(sessionContext.sessionCsv);
    } else {
        log.warn('Skipping master merge (serverless environment detected)');
    }

    if (filtered.length > 0) {
        log.result.success(filtered.length);
    } else {
        log.result.empty('All results filtered out (check US detection logic)');
    }

    return { keyword, sessionId: sessionContext.sessionId, results: filtered };
}
