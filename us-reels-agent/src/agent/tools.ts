export const toolSchemas = [
    {
        type: 'function',
        name: 'serper_search_reels_batch',
        description: 'Batch web search via Serper.dev; returns Instagram reel URLs only, deduped.',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                queries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of search queries. The tool applies site:instagram.com/reel automatically if omitted.'
                }
            },
            required: ['queries'],
            additionalProperties: false
        }
    },
    {
        type: 'function',
        name: 'sc_batch_posts',
        description: 'Fetch trimmed post details for many reel URLs (ScrapeCreators).',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                urls: { type: 'array', items: { type: 'string' } }
            },
            required: ['urls'],
            additionalProperties: false
        }
    },
    {
        type: 'function',
        name: 'sc_batch_transcripts',
        description: 'Fetch transcripts for many reel URLs (ScrapeCreators v2).',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                urls: { type: 'array', items: { type: 'string' } }
            },
            required: ['urls'],
            additionalProperties: false
        }
    },
    {
        type: 'function',
        name: 'sc_batch_profiles',
        description: 'Fetch trimmed profile info for many handles (ScrapeCreators).',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                handles: { type: 'array', items: { type: 'string' } }
            },
            required: ['handles'],
            additionalProperties: false
        }
    },
    {
        type: 'function',
        name: 'analyze_session_data',
        description: 'Analyze your current session CSV data using JavaScript. Returns analysis results (summaries, counts, samples), NOT full data. Use this to: check relevance, count stats, analyze captions/transcripts, find patterns, make decisions about what to fetch next. Supports operations like: "count rows with fitness in transcript", "show summary stats", "filter rows with transcripts", "count unique creators".',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                operation: {
                    type: 'string',
                    description: 'Natural language description of the analysis you want. Examples: "count how many have fitness in transcript", "show summary", "filter rows with captions", "count unique creators", "sample data"'
                }
            },
            required: ['operation'],
            additionalProperties: false
        }
    }
];
