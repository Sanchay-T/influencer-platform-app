import { NextResponse } from 'next/server';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import {
  creatorEnrichmentService,
  CreatorNotFoundError,
  PlanLimitExceededError,
  EnrichmentApiError,
  CreatorEnrichmentResult,
} from '@/lib/services/creator-enrichment';

// Breadcrumb: POST /api/creators/enrich -> validates Clerk/test auth -> delegates to creatorEnrichmentService -> returns usage counters + stored payload.

const ALLOWED_PLATFORMS = new Set(['tiktok', 'instagram', 'youtube']);
const logger = createCategoryLogger(LogCategory.API);

export async function POST(request: Request) {
  let userId: string | null = null;

  try {
    const auth = await getAuthOrTest();
    userId = auth.userId ?? null;
  } catch (authError) {
    logger.error('Failed to resolve auth context for enrichment request', authError instanceof Error ? authError : new Error(String(authError)));
    return NextResponse.json({ error: 'AUTH_RESOLUTION_FAILED' }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const creatorId = typeof body?.creatorId === 'string' && body.creatorId.trim().length ? body.creatorId.trim() : undefined;
  const externalId = typeof body?.externalId === 'string' && body.externalId.trim().length ? body.externalId.trim() : undefined;
  const handleInputRaw = typeof body?.handle === 'string' ? body.handle : '';
  const handle = handleInputRaw.replace(/^@/, '').trim();
  const platformInput = typeof body?.platform === 'string' ? body.platform.toLowerCase() : '';
  const forceRefresh = Boolean(body?.forceRefresh);
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : undefined;
  const profileUrl = typeof body?.profileUrl === 'string' ? body.profileUrl.trim() : undefined;
  const metadata = body?.metadata;

  if (!handle || !platformInput) {
    return NextResponse.json({
      error: 'INVALID_PAYLOAD',
      message: 'handle and platform are required.',
    }, { status: 400 });
  }

  if (!ALLOWED_PLATFORMS.has(platformInput)) {
    return NextResponse.json({
      error: 'UNSUPPORTED_PLATFORM',
      message: `Platform "${platformInput}" is not supported. Use one of: ${Array.from(ALLOWED_PLATFORMS).join(', ')}.`,
    }, { status: 400 });
  }

  try {
    const result: CreatorEnrichmentResult = await creatorEnrichmentService.enrichCreator({
      userId,
      creatorId,
      handle,
      externalId,
      displayName,
      profileUrl,
      metadata,
      platform: platformInput as 'tiktok' | 'instagram' | 'youtube',
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      data: result.record,
      usage: result.usage,
    });
  } catch (error) {
    if (error instanceof CreatorNotFoundError) {
      return NextResponse.json({ error: 'CREATOR_NOT_FOUND', message: error.message }, { status: 404 });
    }

    if (error instanceof PlanLimitExceededError) {
      return NextResponse.json({
        error: 'LIMIT_REACHED',
        message: 'Enrichment limit reached. Upgrade your plan to continue.',
        plan: error.plan,
        usage: error.usage,
        limit: error.limit,
      }, { status: 403 });
    }

    if (error instanceof EnrichmentApiError) {
      const status = error.status >= 500 ? 502 : Math.max(error.status, 400);
      logger.error('Influencers.Club enrichment API failed', error, {
        status: error.status,
      });
      return NextResponse.json({
        error: 'ENRICHMENT_FAILED',
        message: 'Unable to enrich creator at this time. Please retry later.',
        statusCode: error.status,
      }, { status });
    }

    logger.error('Unhandled enrichment error', error instanceof Error ? error : new Error(String(error)), {
      creatorId: creatorId ?? null,
      handle,
      platform: platformInput,
      forceRefresh,
      userId,
    });

    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error while enriching creator.' }, { status: 500 });
  }
}
