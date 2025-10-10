import axios from 'axios';
import pLimit from 'p-limit';
import { CFG } from '../config.js';
import { log } from '../utils/logger.js';

const SC = axios.create({
    baseURL: 'https://api.scrapecreators.com',
    headers: { 'x-api-key': CFG.SC_API_KEY },
    timeout: CFG.TIMEOUT_MS
});

export type PostBrief = {
    url: string;
    shortcode: string | null;
    caption: string;
    owner_handle: string | null;
    owner_name: string | null;
    is_video: boolean;
    product_type: string | null;
    views: number | null;
    taken_at_iso: string | null;
    thumbnail: string | null;
    location_name?: string | null;
};

function toISO(ts?: number | string | null): string | null {
    if (!ts && ts !== 0) return null;
    const n = Number(ts);
    if (!Number.isFinite(n)) return null;
    const ms = String(ts).length <= 10 ? n * 1000 : n;
    try { return new Date(ms).toISOString(); } catch { return null; }
}

export async function scPost(url: string): Promise<PostBrief | null> {
    // Remove trim=true to get full response with owner data
    const { data } = await SC.get('/v1/instagram/post', { params: { url } });
    const m = data?.data?.xdt_shortcode_media ?? {};
    const owner = m?.owner ?? {};
    const caption = m?.edge_media_to_caption?.edges?.[0]?.node?.text ?? '';
    const taken = m?.taken_at_timestamp ?? m?.taken_at ?? null;
    const thumb = m?.thumbnail_src ?? m?.display_url ?? null;
    const locName = m?.location?.name ?? null;

    // Debug logging for owner data extraction
    if (!owner || !owner.username) {
        log.warn(`⚠️  No owner data for ${url.substring(0, 50)}... | Owner exists: ${!!owner} | Has username: ${!!owner?.username}`);
    }

    return {
        url,
        shortcode: m?.shortcode ?? null,
        caption,
        owner_handle: owner?.username ?? null,
        owner_name: owner?.full_name ?? null,
        is_video: !!m?.is_video,
        product_type: m?.product_type ?? null,
        views: m?.video_view_count ?? m?.video_play_count ?? null,
        taken_at_iso: toISO(taken),
        thumbnail: thumb,
        location_name: locName
    };
}

export async function scTranscript(url: string): Promise<{ url: string; transcript: string | null }> {
    const { data } = await SC.get('/v2/instagram/media/transcript', { params: { url } });
    // API returns 'text' field, not 'transcript'
    const t = data?.transcripts?.[0]?.text ?? null;
    return { url, transcript: t };
}

export type ProfileBrief = {
    handle: string;
    full_name: string | null;
    biography: string;
    business_address_json: string | null;
    external_url: string | null;
    is_verified: boolean;
    followers: number | null;
    profile_pic_url?: string | null;
};

export async function scProfile(handle: string): Promise<ProfileBrief> {
    // Remove trim=true to get full response with all profile data
    const { data } = await SC.get('/v1/instagram/profile', { params: { handle } });
    const u = data?.data?.user ?? {};
    return {
        handle: u?.username ?? handle,
        full_name: u?.full_name ?? null,
        biography: u?.biography ?? '',
        business_address_json: u?.business_address_json ?? null,
        external_url: u?.external_url ?? null,
        is_verified: !!u?.is_verified,
        followers: u?.edge_followed_by?.count ?? null,
        profile_pic_url: u?.profile_pic_url ?? null
    };
}

// -------- Batched helpers with high concurrency --------
export async function scBatchPosts(urls: string[]) {
    log.api.request('ScrapeCreators', 'POST /v1/instagram/post', urls.length);
    const limit = pLimit(CFG.PARALLEL);
    const errors: { url: string; error: string }[] = [];

    const tasks = urls.map((u) => limit(async () => {
        try {
            return await scPost(u);
        } catch (e: any) {
            const errorMsg = e?.response?.status === 402 ? '402 Out of credits' : e.message;
            errors.push({ url: u, error: errorMsg });
            return null;
        }
    }));

    const out = (await Promise.all(tasks)).filter(Boolean) as PostBrief[];

    // Log errors if any
    if (errors.length > 0) {
        const uniqueErrors = [...new Set(errors.map(e => e.error))];
        log.warn(`⚠️  ${errors.length} POST requests failed: ${uniqueErrors.join(', ')}`);
    }

    log.api.response('ScrapeCreators', out.length, urls.length, `${urls.length - out.length} failed`);
    return out;
}

export async function scBatchTranscripts(urls: string[]) {
    log.api.request('ScrapeCreators', 'GET /v2/instagram/media/transcript', urls.length);
    const limit = pLimit(CFG.PARALLEL);
    const tasks = urls.map((u) => limit(async () => {
        try { return await scTranscript(u); } catch { return { url: u, transcript: null }; }
    }));
    const out = await Promise.all(tasks);
    const withTranscripts = out.filter(t => t.transcript).length;
    log.api.response('ScrapeCreators', withTranscripts, urls.length, `${urls.length - withTranscripts} empty/failed`);
    return out;
}

export async function scBatchProfiles(handles: string[]) {
    const uniq = Array.from(new Set(handles.filter(Boolean)));
    log.api.request('ScrapeCreators', 'GET /v1/instagram/profile', uniq.length);
    const limit = pLimit(Math.min(CFG.PARALLEL, 24));
    const tasks = uniq.map((h) => limit(async () => {
        try { return await scProfile(h); } catch (e) {
            return null;
        }
    }));
    const out = (await Promise.all(tasks)).filter(Boolean) as ProfileBrief[];
    log.api.response('ScrapeCreators', out.length, uniq.length, `${uniq.length - out.length} failed`);
    return out;
}
