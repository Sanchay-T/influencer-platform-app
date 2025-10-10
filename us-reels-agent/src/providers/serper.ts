import axios from 'axios';
import pLimit from 'p-limit';
import { CFG } from '../config.js';
import { normalizeReelUrl, uniq } from '../utils/instagram.js';
import { log } from '../utils/logger.js';

const SERPER_URL = 'https://google.serper.dev/search';

type SingleSearchOpts = {
    q: string;
    gl?: string;
    hl?: string;
    location?: string;
    num?: number;
    tbs?: string;      // date range etc.
    page?: number;
};

export async function serperSearchRaw(opts: SingleSearchOpts) {
    const payload = {
        q: opts.q,
        gl: opts.gl ?? CFG.SERPER_GL,
        hl: opts.hl ?? CFG.SERPER_HL,
        location: opts.location ?? CFG.SERPER_LOCATION,
        num: opts.num ?? CFG.SERPER_NUM,
        tbs: opts.tbs ?? (CFG.SERPER_TBS || undefined),
        page: opts.page ?? 1,
    };
    const { data } = await axios.post(SERPER_URL, payload, {
        headers: {
            'X-API-KEY': CFG.SERPER_API_KEY,
            'Content-Type': 'application/json',
        },
        timeout: CFG.TIMEOUT_MS,
    });
    return data;
}

export async function serperSearchBatchRaw(queries: SingleSearchOpts[]) {
    // mini‑batch: array payload, per your screenshot/snippet
    const { data } = await axios.post(SERPER_URL, queries, {
        headers: {
            'X-API-KEY': CFG.SERPER_API_KEY,
            'Content-Type': 'application/json',
        },
        timeout: CFG.TIMEOUT_MS,
        maxBodyLength: Infinity,
    });
    return data; // array of results
}

// Extract Instagram reel links from any serper response shape
export function extractReelUrlsFromSerper(data: any): string[] {
    const urls: string[] = [];
    const push = (u?: string) => {
        const n = normalizeReelUrl(u || '');
        if (n) urls.push(n);
    };

    const scan = (obj: any) => {
        if (!obj) return;
        if (Array.isArray(obj)) obj.forEach(scan);
        else if (typeof obj === 'object') {
            for (const [k, v] of Object.entries(obj)) {
                if (k === 'link' && typeof v === 'string') push(v);
                else if (typeof v === 'object') scan(v);
            }
        }
    };
    scan(data);
    return uniq(urls);
}

export async function searchReels(query: string): Promise<string[]> {
    const data = await serperSearchRaw({ q: `site:instagram.com/reel ${query}` });
    return extractReelUrlsFromSerper(data);
}

export async function searchReelsBatch(queries: string[]): Promise<string[]> {
    log.search.queries(queries);

    const qObjs = queries.map((q) => ({
        // Add "United States" to query text for 100% US content filtering
        // Serper gl/hl/location params affect ranking, not filtering
        q: `site:instagram.com/reel ${q} United States`,
        gl: CFG.SERPER_GL,
        hl: CFG.SERPER_HL,
        location: CFG.SERPER_LOCATION,
        num: CFG.SERPER_NUM,
        tbs: CFG.SERPER_TBS || undefined,
    }));

    // If queries > ~100, a single POST still works fine; we also parallelize if needed
    const limit = pLimit(4);
    const chunks: SingleSearchOpts[][] = [qObjs]; // simple; split if desired
    const results = await Promise.all(chunks.map((chunk) =>
        limit(() => serperSearchBatchRaw(chunk))
    ));

    log.api.response('Serper', results.length, chunks.length);

    const all = ([] as string[]).concat(
        ...results.flat().map((res) => extractReelUrlsFromSerper(res))
    );
    const uniqueUrls = uniq(all);

    log.search.results(uniqueUrls);

    return uniqueUrls;
}
