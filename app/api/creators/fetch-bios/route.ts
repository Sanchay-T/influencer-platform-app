import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { scrapingResults } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { extractEmail } from '@/lib/search-engine/utils/email-extractor';

/**
 * POST /api/creators/fetch-bios
 *
 * Batch fetches bio data for multiple creators using ScrapeCreators basic-profile API.
 * Extracts emails from biographies and updates the database.
 *
 * No rate limits on ScrapeCreators - all requests fire in parallel for maximum speed.
 */

const logger = createCategoryLogger(LogCategory.API);

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY;
const BASIC_PROFILE_URL = 'https://api.scrapecreators.com/v1/instagram/basic-profile';

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

interface FetchBiosRequest {
  userIds: string[];
  jobId?: string;
}

interface FetchBiosResponse {
  results: Record<string, BioData>;
  stats: {
    total: number;
    successful: number;
    failed: number;
    durationMs: number;
  };
}

async function fetchSingleBio(userId: string): Promise<{ userId: string; data: BioData }> {
  try {
    const response = await fetch(`${BASIC_PROFILE_URL}?userId=${userId}`, {
      headers: {
        'x-api-key': SCRAPECREATORS_API_KEY!,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        userId,
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

    const biography = profile.biography || null;
    const extracted_email = extractEmail(biography);

    return {
      userId,
      data: {
        biography,
        bio_links: profile.bio_links || [],
        external_url: profile.external_url || null,
        follower_count: profile.follower_count || null,
        extracted_email,
      },
    };
  } catch (error) {
    return {
      userId,
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
      'Failed to resolve auth context for fetch-bios request',
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
  let body: FetchBiosRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const { userIds, jobId } = body;

  // Validate userIds
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: 'INVALID_PAYLOAD', message: 'userIds must be a non-empty array.' },
      { status: 400 }
    );
  }

  // Filter to valid strings and dedupe
  const validUserIds = [...new Set(userIds.filter((id) => typeof id === 'string' && id.trim()))];

  if (validUserIds.length === 0) {
    return NextResponse.json(
      { error: 'INVALID_PAYLOAD', message: 'No valid userIds provided.' },
      { status: 400 }
    );
  }

  logger.info('Starting bio fetch', {
    userId,
    jobId,
    creatorCount: validUserIds.length,
  });

  // Fetch all bios in parallel - NO rate limits!
  const fetchPromises = validUserIds.map((id) => fetchSingleBio(id));
  const results = await Promise.all(fetchPromises);

  // Build results map
  const bioResults: Record<string, BioData> = {};
  let successful = 0;
  let failed = 0;

  for (const result of results) {
    bioResults[result.userId] = result.data;
    if (result.data.error) {
      failed++;
    } else {
      successful++;
    }
  }

  const durationMs = Date.now() - startTime;

  logger.info('Bio fetch completed', {
    userId,
    jobId,
    total: validUserIds.length,
    successful,
    failed,
    durationMs,
  });

  // If jobId provided, update the database with bio data
  if (jobId) {
    try {
      // Update scraping_results: for each creator, add bio_enriched data
      // This uses a single SQL update with jsonb_set for each userId
      const updatePromises = Object.entries(bioResults).map(([creatorUserId, bioData]) => {
        if (bioData.error) return Promise.resolve(); // Skip failed fetches

        const bioEnrichedPayload = JSON.stringify({
          biography: bioData.biography,
          bio_links: bioData.bio_links,
          external_url: bioData.external_url,
          extracted_email: bioData.extracted_email,
          fetched_at: new Date().toISOString(),
        });

        // Update the creator in the JSONB array where owner.id matches
        return db.execute(sql`
          UPDATE scraping_results
          SET creators = (
            SELECT jsonb_agg(
              CASE
                WHEN elem->'owner'->>'id' = ${creatorUserId}
                THEN jsonb_set(elem, '{bio_enriched}', ${bioEnrichedPayload}::jsonb)
                ELSE elem
              END
            )
            FROM jsonb_array_elements(creators) AS elem
          )
          WHERE job_id = ${jobId}::uuid
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(creators) AS elem
              WHERE elem->'owner'->>'id' = ${creatorUserId}
            )
        `);
      });

      await Promise.all(updatePromises.filter(Boolean));

      logger.info('Bio data persisted to database', {
        jobId,
        updatedCount: successful,
      });
    } catch (dbError) {
      // Log but don't fail the request - bio data is still returned
      logger.error(
        'Failed to persist bio data to database',
        dbError instanceof Error ? dbError : new Error(String(dbError)),
        { jobId }
      );
    }
  }

  const response: FetchBiosResponse = {
    results: bioResults,
    stats: {
      total: validUserIds.length,
      successful,
      failed,
      durationMs,
    },
  };

  return NextResponse.json(response);
}
