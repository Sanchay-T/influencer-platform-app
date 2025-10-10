/**
 * Context Optimizer: Reduces AI context window usage
 *
 * Philosophy: AI only needs ENOUGH to verify and decide next steps.
 * Like a human: Check count, see 2-3 samples, move on.
 */

export interface OptimizedResponse {
    summary: {
        total: number;
        successful: number;
        failed: number;
        [key: string]: any;
    };
    samples: any[];
    // Full data stored internally, not sent to AI
    _fullData?: any[];
}

/**
 * Optimize search results for AI context
 */
export function optimizeSearchResults(urls: string[]): any {
    return {
        summary: {
            total_urls: urls.length,
            status: 'success'
        },
        samples: urls.slice(0, 3),
        verification: `Found ${urls.length} reel URLs. Sample: ${urls.slice(0, 2).join(', ')}${urls.length > 2 ? '...' : ''}`
    };
}

/**
 * Optimize post results for AI context
 */
export function optimizePosts(posts: any[]): any {
    const withCaptions = posts.filter(p => p.caption && p.caption.length > 0).length;
    const uniqueOwners = new Set(posts.map(p => p.owner_handle).filter(Boolean)).size;

    return {
        summary: {
            total: posts.length,
            with_captions: withCaptions,
            unique_owners: uniqueOwners,
            status: 'success'
        },
        samples: posts.slice(0, 3).map(p => ({
            url: p.url,
            owner: p.owner_handle,
            caption_preview: p.caption?.substring(0, 100),
            views: p.views,
            is_video: p.is_video
        })),
        verification: `Retrieved ${posts.length} posts from ${uniqueOwners} unique creators. ${withCaptions} have captions.`
    };
}

/**
 * Optimize transcript results for AI context
 */
export function optimizeTranscripts(transcripts: any[]): any {
    const withText = transcripts.filter(t => t.transcript && t.transcript.trim().length > 0);
    const avgLength = withText.length > 0
        ? Math.round(withText.reduce((sum, t) => sum + t.transcript.length, 0) / withText.length)
        : 0;

    return {
        summary: {
            total: transcripts.length,
            with_text: withText.length,
            empty: transcripts.length - withText.length,
            avg_length: avgLength,
            status: 'success'
        },
        samples: withText.slice(0, 3).map(t => ({
            url: t.url,
            text_preview: t.transcript?.substring(0, 150),
            length: t.transcript?.length
        })),
        verification: `Retrieved ${transcripts.length} transcripts. ${withText.length} contain speech (avg ${avgLength} chars). ${transcripts.length - withText.length} are silent/music-only.`
    };
}

/**
 * Optimize profile results for AI context
 */
export function optimizeProfiles(profiles: any[]): any {
    const withBio = profiles.filter(p => p.biography && p.biography.length > 0).length;
    const withBusinessAddr = profiles.filter(p => p.business_address_json).length;
    const verified = profiles.filter(p => p.is_verified).length;

    return {
        summary: {
            total: profiles.length,
            with_bio: withBio,
            with_business_address: withBusinessAddr,
            verified: verified,
            status: 'success'
        },
        samples: profiles.slice(0, 3).map(p => ({
            handle: p.handle,
            full_name: p.full_name,
            bio_preview: p.biography?.substring(0, 100),
            business_address: p.business_address_json ? 'Yes' : 'No',
            external_url: p.external_url,
            is_verified: p.is_verified,
            followers: p.followers
        })),
        verification: `Retrieved ${profiles.length} profiles. ${withBusinessAddr} have business addresses (US indicator). ${verified} are verified.`
    };
}

/**
 * Generic optimizer - fallback for unknown data types
 */
export function optimizeGeneric(data: any[], type: string): any {
    return {
        summary: {
            total: Array.isArray(data) ? data.length : 0,
            type: type,
            status: 'success'
        },
        samples: Array.isArray(data) ? data.slice(0, 3) : [],
        verification: `Retrieved ${Array.isArray(data) ? data.length : 0} ${type} items.`
    };
}

/**
 * Calculate context size reduction
 */
export function calculateSavings(originalSize: number, optimizedSize: number): string {
    const saved = originalSize - optimizedSize;
    const percent = ((saved / originalSize) * 100).toFixed(1);
    return `Saved ${saved} chars (${percent}%)`;
}
