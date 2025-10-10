import { searchReelsBatch } from '../providers/serper.js';
import { scBatchPosts, scBatchTranscripts, scBatchProfiles } from '../providers/scrapecreators.js';
import { log } from '../utils/logger.js';
import { SessionContext } from '../storage/session-manager.js';
import * as CsvWriter from '../storage/csv-writer.js';
import { analyzeSessionData } from '../storage/csv-analyzer.js';
import { buildPostContext, buildTranscriptContext, buildProfileContext } from '../utils/context-builder.js';

/**
 * SMART CONTEXT ARCHITECTURE
 *
 * Instead of dumping raw data, we build INTELLIGENCE:
 * - Statistics and quality scores
 * - Keyword analysis and match rates
 * - Diversity metrics
 * - Actionable recommendations
 * - Small samples for verification (3-5 max)
 *
 * This gives the agent MORE intelligence with LESS tokens!
 */

export async function executeToolCall(call: any, sessionContext: SessionContext): Promise<any> {
    const name = call.function?.name;
    const argsStr = call.function?.arguments || '{}';

    log.tool.start(name, argsStr);

    let args: any = {};
    try {
        args = JSON.parse(argsStr);
    } catch (e) {
        log.error(`Failed to parse arguments: ${e}`);
        return { error: 'Invalid arguments JSON' };
    }

    let result: any;
    try {
        switch (name) {
            case 'serper_search_reels_batch': {
                const queries = args.queries || [];
                log.tool.stats({ 'Query count': queries.length });
                const urls = await searchReelsBatch(queries);

                // AUTO-WRITE: Save URLs to session CSV immediately
                CsvWriter.appendUrls(sessionContext.sessionCsv, urls, sessionContext.keyword);
                log.storage.write('URLs', urls.length);

                // Context-efficient: Just send count + sample URLs
                result = {
                    count: urls.length,
                    samples: urls.slice(0, 5),
                    all_urls: urls  // Full list for AI to use
                };
                log.tool.stats({ 'URLs found': urls.length });
                break;
            }

            case 'sc_batch_posts': {
                const urls = args.urls || [];
                log.tool.stats({ 'Requesting posts': urls.length });
                const fullPosts = await scBatchPosts(urls);

                // AUTO-WRITE: Save post data to session CSV immediately
                CsvWriter.updatePostData(sessionContext.sessionCsv, fullPosts);
                log.storage.update('post data', fullPosts.length);

                // SMART CONTEXT: Build high-quality insights instead of dumping all data
                const smartContext = buildPostContext(fullPosts, sessionContext.keyword);

                result = smartContext;
                log.tool.stats({ 'Posts retrieved': fullPosts.length });
                log.info(`💡 Intelligence: ${smartContext.recommendation}`);
                break;
            }

            case 'sc_batch_transcripts': {
                const urls = args.urls || [];
                log.tool.stats({ 'Requesting transcripts': urls.length });
                const fullTranscripts = await scBatchTranscripts(urls);

                // AUTO-WRITE: Save transcript data to session CSV immediately
                CsvWriter.updateTranscripts(sessionContext.sessionCsv, fullTranscripts);
                log.storage.update('transcripts', fullTranscripts.length);

                // SMART CONTEXT: Build intelligent analysis instead of raw dumps
                const smartContext = buildTranscriptContext(fullTranscripts, sessionContext.keyword);

                result = smartContext;
                log.tool.stats({
                    'Transcripts retrieved': fullTranscripts.length,
                    'With text': smartContext.with_text,
                    'Empty': fullTranscripts.length - smartContext.with_text
                });
                log.info(`💡 Intelligence: ${smartContext.recommendation}`);
                break;
            }

            case 'sc_batch_profiles': {
                const handles = args.handles || [];
                log.tool.stats({ 'Requesting profiles': handles.length });
                const fullProfiles = await scBatchProfiles(handles);

                // Note: Profile US decision will be set by AI in final output
                // We'll update CSV based on AI's decision later
                // For now, just store profile data
                // (US decision update happens in run.ts after AI completes)

                // SMART CONTEXT: Build intelligent US analysis with confidence levels
                const smartContext = buildProfileContext(fullProfiles);

                result = smartContext;
                log.tool.stats({ 'Profiles retrieved': fullProfiles.length });
                log.info(`💡 Intelligence: ${smartContext.recommendation}`);
                break;
            }

            case 'analyze_session_data': {
                const operation = args.operation || 'summary';
                log.info(`📊 Analyzing session data: ${operation.substring(0, 50)}...`);

                const analysisResult = analyzeSessionData(
                    sessionContext.sessionCsv,
                    operation
                );

                if (analysisResult.error) {
                    log.error(`Analysis failed: ${analysisResult.error}`);
                }
                if (analysisResult.output) {
                    log.info(`📈 Result: ${analysisResult.output.substring(0, 200)}`);
                }

                result = {
                    output: analysisResult.output,
                    error: analysisResult.error
                };
                break;
            }

            default:
                log.error(`Unknown tool: ${name}`);
                return { error: `Unknown tool: ${name}` };
        }

        // Calculate context savings
        const originalSize = JSON.stringify(result).length;
        log.info(`Response size: ${(originalSize / 1024).toFixed(2)} KB`);

        log.tool.end(name, result);
        return result;
    } catch (error: any) {
        log.error(`Tool execution failed: ${error.message}`);
        throw error;
    }
}
