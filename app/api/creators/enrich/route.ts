import { NextResponse } from 'next/server';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import {
	type CreatorEnrichmentResult,
	CreatorNotFoundError,
	creatorEnrichmentService,
	EnrichmentApiError,
	PlanLimitExceededError,
} from '@/lib/services/creator-enrichment';
import { isRecord, isString, toRecord } from '@/lib/utils/type-guards';

// @performance Vercel timeout protection - external enrichment API calls can be slow
export const maxDuration = 30;

// Breadcrumb: POST /api/creators/enrich -> validates Clerk/test auth -> delegates to creatorEnrichmentService -> returns usage counters + stored payload.

type AllowedPlatform = 'tiktok' | 'instagram' | 'youtube';
const ALLOWED_PLATFORMS: AllowedPlatform[] = ['tiktok', 'instagram', 'youtube'];
const isAllowedPlatform = (value: string): value is AllowedPlatform =>
	ALLOWED_PLATFORMS.some((platform) => platform === value);
const logger = createCategoryLogger(LogCategory.API);

export async function POST(request: Request) {
	let userId: string | null = null;

	try {
		const auth = await getAuthOrTest();
		userId = auth.userId ?? null;
	} catch (authError) {
		logger.error(
			'Failed to resolve auth context for enrichment request',
			authError instanceof Error ? authError : new Error(String(authError))
		);
		return NextResponse.json({ error: 'AUTH_RESOLUTION_FAILED' }, { status: 500 });
	}

	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
			{ status: 400 }
		);
	}

	const bodyRecord = toRecord(body);
	const creatorId =
		isString(bodyRecord?.creatorId) && bodyRecord.creatorId.trim().length
			? bodyRecord.creatorId.trim()
			: undefined;
	const externalId =
		isString(bodyRecord?.externalId) && bodyRecord.externalId.trim().length
			? bodyRecord.externalId.trim()
			: undefined;
	const handleInputRaw = isString(bodyRecord?.handle) ? bodyRecord.handle : '';
	const handle = handleInputRaw.replace(/^@/, '').trim();
	const platformInput = isString(bodyRecord?.platform) ? bodyRecord.platform.toLowerCase() : '';
	const forceRefresh = Boolean(bodyRecord?.forceRefresh);
	const displayName = isString(bodyRecord?.displayName) ? bodyRecord.displayName.trim() : undefined;
	const profileUrl = isString(bodyRecord?.profileUrl) ? bodyRecord.profileUrl.trim() : undefined;
	const metadata = bodyRecord?.metadata;

	if (!(handle && platformInput)) {
		return NextResponse.json(
			{
				error: 'INVALID_PAYLOAD',
				message: 'handle and platform are required.',
			},
			{ status: 400 }
		);
	}

	if (!isAllowedPlatform(platformInput)) {
		return NextResponse.json(
			{
				error: 'UNSUPPORTED_PLATFORM',
				message: `Platform "${platformInput}" is not supported. Use one of: ${ALLOWED_PLATFORMS.join(', ')}.`,
			},
			{ status: 400 }
		);
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
			platform: platformInput,
			forceRefresh,
		});

		return NextResponse.json({
			success: true,
			data: result.record,
			usage: result.usage,
		});
	} catch (error) {
		if (error instanceof CreatorNotFoundError) {
			return NextResponse.json(
				{ error: 'CREATOR_NOT_FOUND', message: error.message },
				{ status: 404 }
			);
		}

		if (error instanceof PlanLimitExceededError) {
			return NextResponse.json(
				{
					error: 'LIMIT_REACHED',
					message: 'Enrichment limit reached. Upgrade your plan to continue.',
					plan: error.plan,
					usage: error.usage,
					limit: error.limit,
				},
				{ status: 403 }
			);
		}

		if (error instanceof EnrichmentApiError) {
			const status = error.status >= 500 ? 502 : Math.max(error.status, 400);
			logger.error('Influencers.Club enrichment API failed', error, {
				status: error.status,
				payload: error.payload,
			});
			const payload = isRecord(error.payload) ? error.payload : null;
			const detail =
				(isString(payload?.detail) && payload.detail) ||
				(isString(payload?.message) && payload.message) ||
				error.message;
			return NextResponse.json(
				{
					error: 'ENRICHMENT_FAILED',
					message: detail || 'Unable to enrich creator at this time. Please retry later.',
					statusCode: error.status,
				},
				{ status }
			);
		}

		logger.error(
			'Unhandled enrichment error',
			error instanceof Error ? error : new Error(String(error)),
			{
				creatorId: creatorId ?? null,
				handle,
				platform: platformInput,
				forceRefresh,
				userId,
			}
		);

		return NextResponse.json(
			{ error: 'INTERNAL_ERROR', message: 'Unexpected error while enriching creator.' },
			{ status: 500 }
		);
	}
}
