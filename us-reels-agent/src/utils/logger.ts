// Structured logging utility for better analysis and debugging

export const log = {
    // Section headers
    section: (title: string) => {
        console.log(`\n${'═'.repeat(80)}`);
        console.log(`  ${title.toUpperCase()}`);
        console.log(`${'═'.repeat(80)}`);
    },

    subsection: (title: string) => {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`  ${title}`);
        console.log(`${'─'.repeat(60)}`);
    },

    // Agent iterations
    iteration: (num: number, total: number, functionCount: number) => {
        console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
        console.log(`┃  🔄 ITERATION ${num}/${total} - ${functionCount} function call(s)`.padEnd(79) + '┃');
        console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
    },

    // Tool execution
    tool: {
        start: (name: string, args: any) => {
            console.log(`\n┌─ 🔧 TOOL: ${name}`);
            console.log(`│  📥 Input: ${JSON.stringify(args).substring(0, 100)}...`);
        },

        end: (name: string, result: any) => {
            console.log(`│  ✅ Output: ${JSON.stringify(result).substring(0, 100)}...`);
            console.log(`└─ Done\n`);
        },

        stats: (stats: Record<string, any>) => {
            Object.entries(stats).forEach(([key, value]) => {
                console.log(`│  📊 ${key}: ${value}`);
            });
        }
    },

    // Search results
    search: {
        queries: (queries: string[]) => {
            console.log(`\n  🔍 Search Queries (${queries.length}):`);
            queries.forEach((q, i) => {
                console.log(`     ${(i + 1).toString().padStart(2)}. "${q}"`);
            });
        },

        results: (urls: string[], max: number = 5) => {
            console.log(`\n  ✅ Found ${urls.length} URLs`);
            if (urls.length > 0) {
                console.log(`  📋 Sample URLs (first ${Math.min(urls.length, max)}):`);
                urls.slice(0, max).forEach((url, i) => {
                    console.log(`     ${(i + 1).toString().padStart(2)}. ${url}`);
                });
                if (urls.length > max) {
                    console.log(`     ... and ${urls.length - max} more`);
                }
            }
        }
    },

    // API calls
    api: {
        request: (service: string, endpoint: string, count: number) => {
            console.log(`  📤 [${service}] Request: ${endpoint} (${count} items)`);
        },

        response: (service: string, success: number, total: number, details?: string) => {
            const rate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';
            console.log(`  📥 [${service}] Response: ${success}/${total} successful (${rate}%)`);
            if (details) {
                console.log(`     ℹ️  ${details}`);
            }
        },

        error: (service: string, error: string) => {
            console.log(`  ❌ [${service}] Error: ${error}`);
        }
    },

    // Data processing
    data: {
        filter: (before: number, after: number, reason: string) => {
            const removed = before - after;
            const rate = before > 0 ? ((removed / before) * 100).toFixed(1) : '0';
            console.log(`  🔽 Filter: ${reason}`);
            console.log(`     Before: ${before} | After: ${after} | Removed: ${removed} (${rate}%)`);
        },

        summary: (label: string, data: Record<string, any>) => {
            console.log(`\n  📊 ${label}:`);
            Object.entries(data).forEach(([key, value]) => {
                console.log(`     • ${key}: ${value}`);
            });
        }
    },

    // Final results
    result: {
        success: (count: number) => {
            console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
            console.log(`┃  ✅ SUCCESS - ${count} result(s)`.padEnd(79) + '┃');
            console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
        },

        empty: (reason?: string) => {
            console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
            console.log(`┃  ⚠️  NO RESULTS${reason ? ` - ${reason}` : ''}`.padEnd(79) + '┃');
            console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
        }
    },

    // Session management
    session: {
        start: (sessionId: string, sessionPath: string) => {
            console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
            console.log(`┃  📂 SESSION CREATED`.padEnd(79) + '┃');
            console.log(`┃  ID: ${sessionId}`.padEnd(79) + '┃');
            console.log(`┃  Path: ${sessionPath}`.padEnd(79) + '┃');
            console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
        },

        end: (sessionId: string, resultCount: number) => {
            console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
            console.log(`┃  ✅ SESSION COMPLETE`.padEnd(79) + '┃');
            console.log(`┃  ID: ${sessionId}`.padEnd(79) + '┃');
            console.log(`┃  Results: ${resultCount} US reels`.padEnd(79) + '┃');
            console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
        }
    },

    // Storage operations
    storage: {
        write: (dataType: string, count: number) => {
            console.log(`  💾 Wrote ${count} ${dataType} to session CSV`);
        },

        update: (dataType: string, count: number) => {
            console.log(`  🔄 Updated ${count} rows with ${dataType}`);
        }
    },

    // Generic info/warning/error
    info: (msg: string) => console.log(`  ℹ️  ${msg}`),
    warn: (msg: string) => console.log(`  ⚠️  ${msg}`),
    error: (msg: string) => console.log(`  ❌ ${msg}`),
    success: (msg: string) => console.log(`  ✅ ${msg}`)
};
