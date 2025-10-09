// agent.js
import 'dotenv/config';
import OpenAI from 'openai';
import axios from 'axios';
import pLimit from 'p-limit';
import { getJson as serpGetJson } from 'serpapi';

/**
 * ==============================
 * Configuration
 * ==============================
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SC_API_KEY = process.env.SC_API_KEY;

if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY is required');
if (!SC_API_KEY) throw new Error('SC_API_KEY is required');

const RESULT_LIMIT = parseInt(process.env.RESULT_LIMIT || '25', 10);
const US_THRESHOLD = Number(process.env.US_THRESHOLD || '0.6');
const DISCOVERY_NUM = parseInt(process.env.DISCOVERY_NUM || '20', 10);
const TRANSCRIPT_STRATEGY = (process.env.TRANSCRIPT_STRATEGY || 'smart').toLowerCase(); // smart|always|never
const TRANSCRIPT_BUDGET = parseInt(process.env.TRANSCRIPT_BUDGET || '12', 10);

const HTTP_TIMEOUT_MS = 30000;
const RETRIES = 3;
const CONCURRENCY = 6;

/**
 * ==============================
 * Utilities
 * ==============================
 */

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// Minimal retry wrapper around axios.get
async function getWithRetry(url, { params = {}, headers = {}, timeout = HTTP_TIMEOUT_MS } = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
            const res = await axios.get(url, { params, headers, timeout });
            return res.data;
        } catch (err) {
            lastErr = err;
            const status = err?.response?.status;
            const retryable = !status || status >= 500 || status === 429;
            if (!retryable || attempt === RETRIES) {
                throw err;
            }
            await new Promise((r) => setTimeout(r, 300 * attempt));
        }
    }
    throw lastErr;
}

function uniq(arr) {
    return Array.from(new Set(arr));
}

function normalizeUrlToReel(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.hostname.includes('instagram.com')) {
            // Normalize to https://www.instagram.com/reel/<shortcode>
            const parts = u.pathname.split('/').filter(Boolean);
            const idx = parts.indexOf('reel');
            if (idx >= 0 && parts[idx + 1]) {
                return `https://www.instagram.com/reel/${parts[idx + 1].replace(/[^A-Za-z0-9_-]/g, '')}`;
            }
        }
    } catch { }
    return null;
}

function tokenize(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

// Simple keyword match (also supports phrase fallbacks for AirPods Pro -> "airpods" AND "pro")
function keywordMatchScore(keyword, caption = '', transcript = '') {
    const q = tokenize(keyword);
    if (q.length === 0) return 0;
    const cap = tokenize(caption);
    const trn = tokenize(transcript);
    const bag = new Set([...cap, ...trn]);
    let hits = 0;
    q.forEach((t) => {
        if (bag.has(t) || bag.has(t.replace(/\s+/g, ''))) hits += 1; // "airpodspro" edge case
    });
    return hits / q.length;
}

// US bounding boxes: Mainland, Alaska, Hawaii
function isLatLonInUS(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') return false;
    const mainland = lat >= 24.5 && lat <= 49.5 && lon >= -125 && lon <= -66;
    const alaska = lat >= 51 && lat <= 71 && lon >= -170 && lon <= -129;
    const hawaii = lat >= 18.5 && lat <= 22.5 && lon >= -160 && lon <= -154;
    return mainland || alaska || hawaii;
}

const US_STATES = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida',
    'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
    'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
    'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
    'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
    'west virginia', 'wisconsin', 'wyoming', 'dc', 'washington dc', 'd.c.'
];

function computeUSLikelihood(profile = {}, post = {}) {
    let score = 0;
    const evidence = [];

    // 1) post location if present
    const postLoc = post?.location;
    if (postLoc?.lat && postLoc?.lng && isLatLonInUS(postLoc.lat, postLoc.lng)) {
        score += 0.7;
        evidence.push(`post_location: (${postLoc.lat.toFixed(3)}, ${postLoc.lng.toFixed(3)}) in US bounds`);
    } else if (postLoc?.name) {
        const L = postLoc.name.toLowerCase();
        if (US_STATES.some((s) => L.includes(s))) {
            score += 0.4;
            evidence.push(`post_location_name: “${postLoc.name}”`);
        }
    }

    // 2) business_address_json from profile
    try {
        if (profile.business_address_json) {
            const addr = JSON.parse(profile.business_address_json);
            if (typeof addr?.latitude === 'number' && typeof addr?.longitude === 'number') {
                if (isLatLonInUS(addr.latitude, addr.longitude)) {
                    score += 0.7;
                    evidence.push(`business_address lat/lon in US (${addr.latitude.toFixed(3)}, ${addr.longitude.toFixed(3)})`);
                }
            } else if (addr?.city_name) {
                const L = String(addr.city_name).toLowerCase();
                if (US_STATES.some((s) => L.includes(s)) || L.includes('united states') || L.match(/\busa\b/)) {
                    score += 0.5;
                    evidence.push(`business_city: “${addr.city_name}”`);
                }
            }
        }
    } catch { }

    // 3) bio text
    const bio = (profile.biography || '').toLowerCase();
    if (bio.includes('usa') || bio.includes('united states') || US_STATES.some((s) => bio.includes(s))) {
        score += 0.3;
        evidence.push('bio mentions US (state/USA)');
    }

    // Cap to [0,1]
    score = Math.max(0, Math.min(1, score));
    return { us_likelihood: score, us_evidence: evidence };
}

function tsToISO(ts) {
    if (!ts) return null;
    try {
        // Some endpoints use seconds
        if (String(ts).length <= 10) {
            return new Date(Number(ts) * 1000).toISOString();
        }
        return new Date(Number(ts)).toISOString();
    } catch {
        return null;
    }
}

/**
 * ==============================
 * Tool implementations
 * ==============================
 */

// 1) SERP: discover Instagram reel URLs for a keyword
async function serp_search_instagram_reels({ keyword, gl = 'us', hl = 'en', num = DISCOVERY_NUM }) {
    const q = `site:instagram.com/reel ${keyword}`;
    const json = await serpGetJson({
        engine: 'google',
        api_key: SERPAPI_KEY,
        q,
        gl,
        hl,
        num
    });
    const urls = [];
    const pushUrl = (u) => {
        const n = normalizeUrlToReel(u);
        if (n) urls.push(n);
    };
    (json.organic_results || []).forEach((r) => {
        if (r?.link) pushUrl(r.link);
        if (Array.isArray(r?.sitelinks?.links)) r.sitelinks.links.forEach((s) => s.link && pushUrl(s.link));
    });
    // Sometimes reels hide in inline/grouped results
    (json.inline_videos || []).forEach((v) => v.link && pushUrl(v.link));
    return { urls: uniq(urls).slice(0, num) };
}

// 2) ScrapeCreators: POST detail (reel)
async function sc_post_detail({ url, trim = true }) {
    const data = await getWithRetry('https://api.scrapecreators.com/v1/instagram/post', {
        params: { url, trim },
        headers: { 'x-api-key': SC_API_KEY }
    });
    const media = data?.data?.xdt_shortcode_media || {};
    const owner = media?.owner || {};
    const captionEdge = media?.edge_media_to_caption?.edges?.[0]?.node?.text ?? '';
    // Some fields vary by post type; be defensive:
    const takenAt = media?.taken_at_timestamp || media?.taken_at || null;
    const views = media?.video_view_count ?? media?.video_play_count ?? null;
    const thumb = media?.thumbnail_src ?? media?.display_url ?? null;

    // A few posts include location, many don’t; if present we normalize
    const location = media?.location
        ? {
            name: media.location?.name || null,
            lat: typeof media.location?.lat === 'number' ? media.location.lat : undefined,
            lng: typeof media.location?.lng === 'number' ? media.location.lng : undefined
        }
        : null;

    return {
        ok: true,
        url,
        shortcode: media?.shortcode || null,
        caption: captionEdge || '',
        owner_handle: owner?.username || null,
        owner_name: owner?.full_name || null,
        is_video: !!media?.is_video,
        product_type: media?.product_type || null,
        views,
        taken_at_iso: tsToISO(takenAt),
        thumbnail: thumb,
        location
    };
}

// 3) ScrapeCreators: transcript
async function sc_transcript({ url }) {
    const data = await getWithRetry('https://api.scrapecreators.com/v2/instagram/media/transcript', {
        params: { url },
        headers: { 'x-api-key': SC_API_KEY }
    });
    const t = data?.transcripts?.[0]?.transcript || null;
    return { url, transcript: t };
}

// 4) ScrapeCreators: profile
async function sc_profile({ handle, trim = true }) {
    const data = await getWithRetry('https://api.scrapecreators.com/v1/instagram/profile', {
        params: { handle, trim },
        headers: { 'x-api-key': SC_API_KEY }
    });
    const user = data?.data?.user || {};
    const { us_likelihood, us_evidence } = computeUSLikelihood(user, null);
    return {
        handle: user?.username || handle,
        full_name: user?.full_name || null,
        biography: user?.biography || '',
        business_address_json: user?.business_address_json || null,
        external_url: user?.external_url || null,
        is_verified: !!user?.is_verified,
        followers: user?.edge_followed_by?.count ?? null,
        us_likelihood,
        us_evidence
    };
}

// 5) ScrapeCreators: user reels (simple)
async function sc_user_reels_simple({ handle, user_id = null, amount = 12, trim = true }) {
    const params = { amount, trim };
    if (user_id) params.user_id = user_id;
    else params.handle = handle;

    const arr = await getWithRetry('https://api.scrapecreators.com/v1/instagram/user/reels/simple', {
        params,
        headers: { 'x-api-key': SC_API_KEY }
    });

    // Extract canonical reel URLs if present
    const urls = [];
    for (const item of arr || []) {
        const url = item?.media?.url;
        const n = normalizeUrlToReel(url);
        if (n) urls.push(n);
    }
    return { handle: handle || null, urls: uniq(urls) };
}

/**
 * ==============================
 * OpenAI tool schemas
 * ==============================
 */

const toolSchemas = [
    {
        type: 'function',
        function: {
            name: 'serp_search_instagram_reels',
            description:
                'Discover Instagram reel URLs for a keyword using Google search (site:instagram.com/reel <keyword>).',
            parameters: {
                type: 'object',
                properties: {
                    keyword: { type: 'string' },
                    gl: { type: 'string', description: 'Country code (default us)' },
                    hl: { type: 'string', description: 'Language (default en)' },
                    num: { type: 'integer', description: 'Max URLs to return (<= 50)' }
                },
                required: ['keyword']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'sc_post_detail',
            description: 'Get detailed information about an Instagram post or reel (ScrapeCreators).',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    trim: { type: 'boolean' }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'sc_transcript',
            description: 'Get the transcript of an Instagram reel/post (ScrapeCreators v2).',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string' }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'sc_profile',
            description:
                'Get public Instagram profile data and US-likelihood (computed) for a handle (ScrapeCreators).',
            parameters: {
                type: 'object',
                properties: {
                    handle: { type: 'string' },
                    trim: { type: 'boolean' }
                },
                required: ['handle']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'sc_user_reels_simple',
            description:
                "Get recent public reels from a user's profile (ScrapeCreators). Use this to expand promising US creators.",
            parameters: {
                type: 'object',
                properties: {
                    handle: { type: 'string' },
                    user_id: { type: 'string' },
                    amount: { type: 'integer' },
                    trim: { type: 'boolean' }
                }
            }
        }
    }
];

/**
 * Route tool calls to our implementations.
 */
async function executeToolCall(toolCall) {
    const name = toolCall.function.name;
    const args = safeParseJSON(toolCall.function.arguments);

    try {
        switch (name) {
            case 'serp_search_instagram_reels':
                return await serp_search_instagram_reels(args);
            case 'sc_post_detail':
                return await sc_post_detail(args);
            case 'sc_transcript':
                return await sc_transcript(args);
            case 'sc_profile':
                return await sc_profile(args);
            case 'sc_user_reels_simple':
                return await sc_user_reels_simple(args);
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (err) {
        return {
            error: String(err?.response?.data?.error || err?.message || err)
        };
    }
}

function safeParseJSON(s) {
    try {
        return s ? JSON.parse(s) : {};
    } catch {
        return {};
    }
}

/**
 * ==============================
 * Agent loop (Responses API)
 * ==============================
 *
 * We:
 * 1) Create an initial response with tools enabled and strict JSON schema.
 * 2) If the model asks to call tools, we execute them and POST tool_outputs back
 *    using previous_response_id to continue the loop.
 * 3) Repeat until status === 'completed', then parse final JSON.
 *
 * Notes:
 * - See OpenAI docs for tool calling and Responses API chaining via previous_response_id and tool_outputs.
 */

function buildSystemPrompt({ keyword }) {
    return [
        {
            role: 'system',
            content: [
                {
                    type: 'text',
                    text: `You are a focused retrieval agent. 
Goal: Return ONLY US-based Instagram Reels that match the user's keyword, along with transcripts when helpful. 
Use the provided tools to:
1) Discover candidate reel URLs (serp_search_instagram_reels).
2) Hydrate each candidate (sc_post_detail).
3) If caption doesn't clearly include the keyword tokens, fetch transcript (sc_transcript) — but keep within budget.
4) For each unique owner, fetch profile (sc_profile) and use its us_likelihood and evidence.
5) If too few results, expand from promising US creators using sc_user_reels_simple, then hydrate those items.
Filter: keep items with us_likelihood >= ${US_THRESHOLD}.
Output: a JSON object of 'keyword' and 'results[]' (see schema).
Constraints & Tips:
- Prefer exact-match reels (caption or transcript includes the keyword tokens). 
- De-duplicate by url/shortcode.
- Rank by: (A) text match quality, then (B) views, then (C) recency.
- Include transcript text if available; empty string if none.
- Don't exceed ${RESULT_LIMIT} items. 
- The transcript endpoint is slow; be selective (“${TRANSCRIPT_STRATEGY}” strategy) and keep total transcripts <= ${TRANSCRIPT_BUDGET}.`
                }
            ]
        },
        {
            role: 'developer',
            content: [
                {
                    type: 'text',
                    text: `User keyword: "${keyword}". Start with serp_search_instagram_reels using 'site:instagram.com/reel ${keyword}'.
Then call sc_post_detail for each URL returned. 
Call sc_transcript for items whose caption DOESN'T match the keyword well. 
Call sc_profile for each owner_handle you encounter to confirm US. 
Optionally call sc_user_reels_simple for strong US creators if you need more results.`
                }
            ]
        }
    ];
}

// Strict JSON schema for the final output.
const responseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'USReelsSearchResult',
        schema: {
            type: 'object',
            required: ['keyword', 'results'],
            properties: {
                keyword: { type: 'string' },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['url', 'owner_handle', 'us_likelihood'],
                        properties: {
                            url: { type: 'string' },
                            caption: { type: 'string' },
                            transcript: { type: 'string' },
                            owner_handle: { type: 'string' },
                            owner_name: { type: 'string' },
                            views: { type: 'number' },
                            taken_at_iso: { type: 'string' },
                            thumbnail: { type: 'string' },
                            us_likelihood: { type: 'number' },
                            us_evidence: {
                                type: 'array',
                                items: { type: 'string' }
                            }
                        }
                    }
                }
            },
            additionalProperties: false
        }
    }
};

async function runAgent({ keyword }) {
    const input = [
        ...buildSystemPrompt({ keyword }),
        { role: 'user', content: [{ type: 'text', text: keyword }] }
    ];

    let resp = await client.responses.create({
        model: 'gpt-4o-mini', // fast + tool-capable
        input,
        tools: toolSchemas,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        response_format: responseFormat,
        temperature: 0
    });

    // Loop until completed
    while (resp.status !== 'completed') {
        const required = resp.required_action?.submit_tool_outputs?.tool_calls || [];
        if (!required.length) {
            // If the model didn't request tools but is not completed, break to avoid deadlock
            break;
        }

        // Execute all tool calls with concurrency control
        const limit = pLimit(CONCURRENCY);
        const tool_outputs = await Promise.all(
            required.map((call) =>
                limit(async () => {
                    const output = await executeToolCall(call);
                    return {
                        tool_call_id: call.id,
                        output: JSON.stringify(output ?? {})
                    };
                })
            )
        );

        // Submit tool outputs and continue from previous_response_id
        resp = await client.responses.create({
            model: 'gpt-4o-mini',
            previous_response_id: resp.id,
            tool_outputs,
            // Keep the same schema for the final answer
            response_format: responseFormat,
            temperature: 0
        });
    }

    // Extract final JSON
    const finalText =
        resp?.output?.flatMap((it) =>
            it?.content?.filter((c) => c.type === 'output_text').map((c) => c.text)
        ).join('') || '';

    let json;
    try {
        json = JSON.parse(finalText);
    } catch {
        // As a fallback, return raw text
        json = { keyword, results: [], raw: finalText };
    }

    return json;
}

/**
 * ==============================
 * CLI entry
 * ==============================
 */

async function main() {
    const keyword = process.argv.slice(2).join(' ').trim();
    if (!keyword) {
        console.error('Usage: node agent.js "<keyword>"');
        process.exit(1);
    }

    const result = await runAgent({ keyword });

    // Apply final deterministic filters (belt-and-suspenders):
    const cleaned = {
        keyword,
        results: (result.results || [])
            .filter((r) => r?.url && (r.us_likelihood ?? 0) >= US_THRESHOLD)
            .slice(0, RESULT_LIMIT)
    };

    console.log(JSON.stringify(cleaned, null, 2));
}

main().catch((err) => {
    console.error(err?.response?.data || err);
    process.exit(1);
});
