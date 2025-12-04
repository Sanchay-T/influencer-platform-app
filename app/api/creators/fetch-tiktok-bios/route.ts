import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { extractEmail } from '@/lib/search-engine/utils/email-extractor';

/**
 * POST /api/creators/fetch-tiktok-bios
 *
 * Batch fetches bio data for TikTok creators using ScrapeCreators profile API.
 * Extracts biography, bioLink (external URL), and emails.
 *
 * Similar to Instagram fetch-bios but uses TikTok-specific API and field mappings.
 */

const logger = createCategoryLogger(LogCategory.API);

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY;
const TIKTOK_PROFILE_URL = 'https://api.scrapecreators.com/v1/tiktok/profile';

interface BioLink {
	url: string;
	title: string;
}

interface BioData {
	biography: string | null;
	bio_links: BioLink[];
	external_url: string | null;
	follower_count: number | null;
	extracted_email: string | null;
	error?: string;
}

interface FetchTikTokBiosRequest {
	handles: string[];
	jobId?: string;
}

interface FetchTikTokBiosResponse {
	results: Record<string, BioData>;
	stats: {
		total: number;
		successful: number;
		failed: number;
		durationMs: number;
	};
}

async function fetchSingleTikTokBio(handle: string): Promise<{ handle: string; data: BioData }> {
	try {
		const response = await fetch(`${TIKTOK_PROFILE_URL}?handle=${encodeURIComponent(handle)}`, {
			headers: {
				'x-api-key': SCRAPECREATORS_API_KEY!,
			},
			signal: AbortSignal.timeout(15000),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return {
				handle,
				data: {
					biography: null,
					bio_links: [],
					external_url: null,
					follower_count: null,
					extracted_email: null,
					error: `API error: ${response.status} - ${errorText.slice(0, 100)}`,
				},
			};
		}

		const profile = await response.json();
		const user = profile.user || {};
		const stats = profile.stats || {};

		// Extract bio from user.signature
		const biography = user.signature || null;
		const extractedEmail = extractEmail(biography);

		// Extract bioLink (external URL in TikTok bio)
		const bioLink = user.bioLink?.link || null;

		// Format bio_links array to match Instagram format
		const bioLinks: BioLink[] = bioLink ? [{ url: bioLink, title: 'Link in bio' }] : [];

		return {
			handle,
			data: {
				biography,
				bio_links: bioLinks,
				external_url: bioLink,
				follower_count: stats.followerCount || null,
				extracted_email: extractedEmail,
			},
		};
	} catch (error) {
		return {
			handle,
			data: {
				biography: null,
				bio_links: [],
				external_url: null,
				follower_count: null,
				extracted_email: null,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		};
	}
}

export async function POST(request: Request) {
	const startTime = Date.now();

	// Auth check
	let userId: string | null = null;
	try {
		const auth = await getAuthOrTest();
		userId = auth.userId ?? null;
	} catch (authError) {
		logger.error(
			'Failed to resolve auth context for fetch-tiktok-bios request',
			authError instanceof Error ? authError : new Error(String(authError))
		);
		return NextResponse.json({ error: 'AUTH_RESOLUTION_FAILED' }, { status: 500 });
	}

	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Validate API key
	if (!SCRAPECREATORS_API_KEY) {
		logger.error('SCRAPECREATORS_API_KEY not configured', new Error('Missing API key'));
		return NextResponse.json({ error: 'SERVICE_NOT_CONFIGURED' }, { status: 500 });
	}

	// Parse request body
	let body: FetchTikTokBiosRequest;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
			{ status: 400 }
		);
	}

	const { handles, jobId } = body;

	// Validate handles
	if (!Array.isArray(handles) || handles.length === 0) {
		return NextResponse.json(
			{ error: 'INVALID_PAYLOAD', message: 'handles must be a non-empty array.' },
			{ status: 400 }
		);
	}

	// Filter to valid strings and dedupe
	const validHandles = [...new Set(handles.filter((h) => typeof h === 'string' && h.trim()))];

	if (validHandles.length === 0) {
		return NextResponse.json(
			{ error: 'INVALID_PAYLOAD', message: 'No valid handles provided.' },
			{ status: 400 }
		);
	}

	logger.info('Starting TikTok bio fetch', {
		userId,
		jobId,
		creatorCount: validHandles.length,
	});

	// Fetch all bios in parallel - no rate limits
	const fetchPromises = validHandles.map((handle) => fetchSingleTikTokBio(handle));
	const results = await Promise.all(fetchPromises);

	// Build results map (keyed by handle for TikTok)
	const bioResults: Record<string, BioData> = {};
	let successful = 0;
	let failed = 0;

	for (const result of results) {
		bioResults[result.handle] = result.data;
		if (result.data.error) {
			failed++;
		} else {
			successful++;
		}
	}

	const durationMs = Date.now() - startTime;

	logger.info('TikTok bio fetch completed', {
		userId,
		jobId,
		total: validHandles.length,
		successful,
		failed,
		durationMs,
	});

	// If jobId provided, update the database with bio data
	if (jobId) {
		try {
			// Update scraping_results: for each creator, add bio_enriched data
			// TikTok uses creator.uniqueId or creator.username as the key
			const updatePromises = Object.entries(bioResults).map(([creatorHandle, bioData]) => {
				if (bioData.error) return Promise.resolve(); // Skip failed fetches

				const bioEnrichedPayload = JSON.stringify({
					biography: bioData.biography,
					bio_links: bioData.bio_links,
					external_url: bioData.external_url,
					extracted_email: bioData.extracted_email,
					fetched_at: new Date().toISOString(),
				});

				// Update the creator in the JSONB array where creator.uniqueId or creator.username matches
				return db.execute(sql`
          UPDATE scraping_results
          SET creators = (
            SELECT jsonb_agg(
              CASE
                WHEN (elem->'creator'->>'uniqueId' = ${creatorHandle}
                      OR elem->'creator'->>'username' = ${creatorHandle})
                THEN jsonb_set(elem, '{bio_enriched}', ${bioEnrichedPayload}::jsonb)
                ELSE elem
              END
            )
            FROM jsonb_array_elements(creators) AS elem
          )
          WHERE job_id = ${jobId}::uuid
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(creators) AS elem
              WHERE elem->'creator'->>'uniqueId' = ${creatorHandle}
                 OR elem->'creator'->>'username' = ${creatorHandle}
            )
        `);
			});

			await Promise.all(updatePromises.filter(Boolean));

			logger.info('TikTok bio data persisted to database', {
				jobId,
				updatedCount: successful,
			});
		} catch (dbError) {
			// Log but don't fail the request - bio data is still returned
			logger.error(
				'Failed to persist TikTok bio data to database',
				dbError instanceof Error ? dbError : new Error(String(dbError)),
				{ jobId }
			);
		}
	}

	const response: FetchTikTokBiosResponse = {
		results: bioResults,
		stats: {
			total: validHandles.length,
			successful,
			failed,
			durationMs,
		},
	};

	return NextResponse.json(response);
}
