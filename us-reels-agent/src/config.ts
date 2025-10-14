import 'dotenv/config';

export const CFG = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    SERPER_API_KEY: process.env.SERPER_API_KEY || '',
    SC_API_KEY: process.env.SC_API_KEY || '',

    MODEL: process.env.MODEL || 'gpt-4o-mini', // restore mini as default
    MAX_RESULTS: Number(process.env.MAX_RESULTS || 60),
    PARALLEL: Number(process.env.PARALLEL || 16),
    RETRY: Number(process.env.RETRY || 3),
    TIMEOUT_MS: Number(process.env.TIMEOUT_MS || 30000),

    // Serper
    SERPER_GL: process.env.SERPER_GL || 'us',
    SERPER_HL: process.env.SERPER_HL || 'en',
    SERPER_LOCATION: process.env.SERPER_LOCATION || 'United States',
    SERPER_NUM: Number(process.env.SERPER_NUM || 20),
    SERPER_TBS: process.env.SERPER_TBS || '',

    // Behavior
    TRANSCRIPTS: (process.env.TRANSCRIPTS || 'always').toLowerCase() as 'always' | 'smart' | 'never',
    PER_CREATOR_CAP: Number(process.env.PER_CREATOR_CAP || 2),
};

for (const [k, v] of Object.entries({
    OPENAI_API_KEY: CFG.OPENAI_API_KEY,
    SERPER_API_KEY: CFG.SERPER_API_KEY,
    SC_API_KEY: CFG.SC_API_KEY,
})) {
    if (!v) throw new Error(`Missing required env: ${k}`);
}
