export const SearchResultSchema = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'USReelsSearchResult',
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['keyword', 'results'],
            properties: {
                keyword: { type: 'string' },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['url', 'caption', 'transcript', 'owner_handle', 'owner_name', 'taken_at_iso', 'views', 'thumbnail', 'us_decision', 'relevance_decision', 'confidence', 'reasons'],
                        properties: {
                            url: { type: 'string' },
                            caption: { type: 'string' },
                            transcript: { type: 'string' },
                            owner_handle: { type: 'string' },
                            owner_name: { type: 'string' },
                            taken_at_iso: { type: 'string' },
                            views: { type: 'number' },
                            thumbnail: { type: 'string' },
                            us_decision: { enum: ['US', 'NotUS', 'Unknown'] },
                            relevance_decision: { enum: ['match', 'partial', 'no'] },
                            confidence: { type: 'number' },
                            reasons: { type: 'array', items: { type: 'string' } }
                        }
                    }
                }
            }
        }
    }
};
