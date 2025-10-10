/**
 * Context Builder - Creates high-quality, condensed context for the agent
 * Philosophy: Give the agent INSIGHTS, not raw data dumps
 */

import { PostBrief } from '../providers/scrapecreators.js';

export interface SmartPostContext {
    total: number;
    quality_score: 'excellent' | 'good' | 'fair' | 'poor';
    statistics: {
        with_captions: number;
        caption_quality: 'high' | 'medium' | 'low';
        avg_views: number;
        has_location: number;
        unique_owners: number;
    };
    keyword_analysis: {
        in_captions: number;
        caption_match_rate: string;
    };
    diversity: {
        unique_creators: number;
        top_creators: Array<{ handle: string; post_count: number }>;
    };
    samples: Array<{
        url: string;
        owner_handle: string;
        caption_preview: string;  // First 100 chars only
        views: number | null;
        has_location: boolean;
        relevance_hint: 'strong' | 'medium' | 'weak';
    }>;
    recommendation: string;  // AI can use this for next steps
}

export interface SmartTranscriptContext {
    total: number;
    with_text: number;
    success_rate: string;
    quality_score: 'excellent' | 'good' | 'fair' | 'poor';
    keyword_analysis: {
        matches: number;
        match_rate: string;
        relevance: 'high' | 'medium' | 'low';
    };
    samples: Array<{
        url: string;
        transcript_preview: string;  // First 150 chars
        has_keyword: boolean;
        relevance_hint: 'strong' | 'medium' | 'weak';
    }>;
    recommendation: string;
}

export interface SmartProfileContext {
    total: number;
    us_indicators: {
        with_business_address: number;
        likely_us_from_bio: number;
        com_domains: number;
        verified_accounts: number;
    };
    confidence: {
        high: number;   // Strong US signals
        medium: number; // Some US signals
        low: number;    // Weak/no signals
    };
    samples: Array<{
        handle: string;
        us_signals: string[];  // ["business_address", ".com domain", "verified"]
        confidence: 'high' | 'medium' | 'low';
    }>;
    recommendation: string;
}

/**
 * Analyze keyword presence in text
 */
function hasKeyword(text: string | undefined, keyword: string): boolean {
    if (!text) return false;
    const normalizedText = text.toLowerCase();
    const normalizedKeyword = keyword.toLowerCase();

    // Check exact match or word variations
    return normalizedText.includes(normalizedKeyword) ||
           normalizedText.includes(normalizedKeyword.replace(' ', ''));
}

/**
 * Determine relevance hint based on keyword presence and other signals
 */
function getRelevanceHint(caption: string | undefined, keyword: string): 'strong' | 'medium' | 'weak' {
    if (!caption) return 'weak';

    const hasExactMatch = hasKeyword(caption, keyword);
    const captionLength = caption.length;

    if (hasExactMatch && captionLength > 50) return 'strong';
    if (hasExactMatch) return 'medium';
    return 'weak';
}

/**
 * Build smart context for posts
 */
export function buildPostContext(posts: PostBrief[], keyword: string): SmartPostContext {
    const total = posts.length;
    const withCaptions = posts.filter(p => p.caption && p.caption.length > 10).length;
    const withLocation = posts.filter(p => p.location_name).length;

    // Calculate unique owners
    const uniqueOwners = new Set(posts.map(p => p.owner_handle).filter(Boolean));

    // Top creators (for diversity check)
    const ownerCounts = new Map<string, number>();
    posts.forEach(p => {
        if (p.owner_handle) {
            ownerCounts.set(p.owner_handle, (ownerCounts.get(p.owner_handle) || 0) + 1);
        }
    });
    const topCreators = Array.from(ownerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([handle, count]) => ({ handle, post_count: count }));

    // Keyword analysis
    const keywordInCaptions = posts.filter(p => hasKeyword(p.caption, keyword)).length;
    const captionMatchRate = withCaptions > 0
        ? `${Math.round((keywordInCaptions / withCaptions) * 100)}%`
        : '0%';

    // Calculate average views
    const viewsArray = posts.filter(p => p.views && p.views > 0).map(p => p.views!);
    const avgViews = viewsArray.length > 0
        ? Math.round(viewsArray.reduce((a, b) => a + b, 0) / viewsArray.length)
        : 0;

    // Quality score
    const captionQuality = withCaptions / total > 0.8 ? 'high' : withCaptions / total > 0.5 ? 'medium' : 'low';
    const qualityScore =
        captionQuality === 'high' && withLocation > total * 0.3 ? 'excellent' :
        captionQuality === 'high' || withLocation > total * 0.3 ? 'good' :
        withCaptions > total * 0.5 ? 'fair' : 'poor';

    // Select diverse samples (max 5)
    const samples = posts
        .slice(0, 10)  // Consider first 10
        .filter((p, i, arr) => {
            // Ensure diversity - don't pick multiple from same owner
            const prevOwners = arr.slice(0, i).map(x => x.owner_handle);
            return !prevOwners.includes(p.owner_handle);
        })
        .slice(0, 5)  // Take max 5
        .map(p => ({
            url: p.url,
            owner_handle: p.owner_handle || 'unknown',
            caption_preview: p.caption ? p.caption.substring(0, 100) + (p.caption.length > 100 ? '...' : '') : '[no caption]',
            views: p.views,
            has_location: !!p.location_name,
            relevance_hint: getRelevanceHint(p.caption, keyword)
        }));

    // Smart recommendation
    let recommendation = '';
    if (keywordInCaptions < total * 0.3) {
        recommendation = 'Low keyword match rate. Consider fetching transcripts to verify relevance.';
    } else if (withCaptions < total * 0.5) {
        recommendation = 'Many posts lack captions. Transcripts will help determine relevance.';
    } else {
        recommendation = 'Good caption coverage. Posts appear relevant based on text analysis.';
    }

    return {
        total,
        quality_score: qualityScore,
        statistics: {
            with_captions: withCaptions,
            caption_quality: captionQuality,
            avg_views: avgViews,
            has_location: withLocation,
            unique_owners: uniqueOwners.size
        },
        keyword_analysis: {
            in_captions: keywordInCaptions,
            caption_match_rate: captionMatchRate
        },
        diversity: {
            unique_creators: uniqueOwners.size,
            top_creators: topCreators
        },
        samples,
        recommendation
    };
}

/**
 * Build smart context for transcripts
 */
export function buildTranscriptContext(
    transcripts: Array<{ url: string; transcript: string | null }>,
    keyword: string
): SmartTranscriptContext {
    const total = transcripts.length;
    const withText = transcripts.filter(t => t.transcript && t.transcript.length > 10).length;
    const successRate = `${Math.round((withText / total) * 100)}%`;

    // Keyword analysis
    const matches = transcripts.filter(t => hasKeyword(t.transcript || '', keyword)).length;
    const matchRate = withText > 0 ? `${Math.round((matches / withText) * 100)}%` : '0%';
    const relevance = matches / withText > 0.5 ? 'high' : matches / withText > 0.2 ? 'medium' : 'low';

    // Quality score
    const qualityScore =
        withText / total > 0.6 && matches / withText > 0.4 ? 'excellent' :
        withText / total > 0.4 && matches / withText > 0.2 ? 'good' :
        withText / total > 0.2 ? 'fair' : 'poor';

    // Select samples with transcripts (max 5)
    const samples = transcripts
        .filter(t => t.transcript && t.transcript.length > 10)
        .slice(0, 5)
        .map(t => {
            const hasKw = hasKeyword(t.transcript || '', keyword);
            return {
                url: t.url,
                transcript_preview: t.transcript!.substring(0, 150) + (t.transcript!.length > 150 ? '...' : ''),
                has_keyword: hasKw,
                relevance_hint: hasKw ? 'strong' : 'weak' as 'strong' | 'medium' | 'weak'
            };
        });

    // Smart recommendation
    let recommendation = '';
    if (withText < total * 0.3) {
        recommendation = 'Low transcript success rate. Most videos lack captions. Proceed with available data.';
    } else if (matches < withText * 0.3) {
        recommendation = 'Few transcripts mention keyword. Consider broader search or rely on post metadata.';
    } else {
        recommendation = 'Good transcript coverage with keyword matches. Strong relevance indicators.';
    }

    return {
        total,
        with_text: withText,
        success_rate: successRate,
        quality_score: qualityScore,
        keyword_analysis: {
            matches,
            match_rate: matchRate,
            relevance
        },
        samples,
        recommendation
    };
}

/**
 * Build smart context for profiles (US verification)
 */
export function buildProfileContext(
    profiles: Array<{
        handle: string;
        biography: string;
        business_address_json: string | null;
        external_url: string | null;
        is_verified: boolean;
    }>
): SmartProfileContext {
    const total = profiles.length;

    // Analyze US indicators
    const withBusinessAddress = profiles.filter(p => p.business_address_json).length;
    const likelyUsFromBio = profiles.filter(p => {
        const bio = p.biography?.toLowerCase() || '';
        return bio.includes('usa') || bio.includes('united states') ||
               /\b(ny|nyc|la|sf|chicago|miami|texas|california)\b/.test(bio);
    }).length;
    const comDomains = profiles.filter(p => p.external_url?.includes('.com')).length;
    const verified = profiles.filter(p => p.is_verified).length;

    // Confidence levels
    const confidence = { high: 0, medium: 0, low: 0 };

    const samples = profiles.slice(0, 5).map(p => {
        const signals: string[] = [];
        let conf: 'high' | 'medium' | 'low' = 'low';

        if (p.business_address_json) {
            signals.push('business_address');
            conf = 'high';
        }
        if (p.external_url?.includes('.com')) {
            signals.push('.com domain');
            if (conf === 'low') conf = 'medium';
        }
        if (p.is_verified) {
            signals.push('verified');
            if (conf === 'low') conf = 'medium';
        }

        const bio = p.biography?.toLowerCase() || '';
        if (bio.includes('usa') || bio.includes('united states')) {
            signals.push('US in bio');
            conf = 'high';
        }

        confidence[conf]++;

        return {
            handle: p.handle,
            us_signals: signals,
            confidence: conf
        };
    });

    // Smart recommendation
    let recommendation = '';
    if (confidence.high > total * 0.5) {
        recommendation = 'Strong US signals for most profiles. High confidence in US location.';
    } else if (confidence.high + confidence.medium > total * 0.6) {
        recommendation = 'Moderate US signals. Acceptable confidence, consider accepting Unknown profiles.';
    } else {
        recommendation = 'Weak US signals. Most profiles lack clear location indicators. Search may need US-specific terms.';
    }

    return {
        total,
        us_indicators: {
            with_business_address: withBusinessAddress,
            likely_us_from_bio: likelyUsFromBio,
            com_domains: comDomains,
            verified_accounts: verified
        },
        confidence,
        samples,
        recommendation
    };
}
