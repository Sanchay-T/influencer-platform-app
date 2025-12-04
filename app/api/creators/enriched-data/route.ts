import { NextResponse } from 'next/server';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { creatorEnrichmentService } from '@/lib/services/creator-enrichment';
import type { CreatorEnrichmentPlatform } from '@/types/creator-enrichment';

const ALLOWED_PLATFORMS = new Set<CreatorEnrichmentPlatform>(['tiktok', 'instagram', 'youtube']);
const logger = createCategoryLogger(LogCategory.API);

export async function GET(request: Request) {
	try {
		const auth = await getAuthOrTest();
		if (!auth.userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
	} catch (authError) {
		logger.error(
			'Failed to resolve auth context for enrichment lookup',
			authError instanceof Error ? authError : new Error(String(authError))
		);
		return NextResponse.json({ error: 'AUTH_RESOLUTION_FAILED' }, { status: 500 });
	}

	const url = new URL(request.url);
	const handle = url.searchParams.get('handle');
	const platformRaw = url.searchParams.get('platform');

	if (!(handle && platformRaw)) {
		return NextResponse.json(
			{ error: 'INVALID_QUERY', message: 'handle and platform query params are required.' },
			{ status: 400 }
		);
	}

	const platform = platformRaw.toLowerCase() as CreatorEnrichmentPlatform;
	if (!ALLOWED_PLATFORMS.has(platform)) {
		return NextResponse.json(
			{
				error: 'UNSUPPORTED_PLATFORM',
				message: `Platform "${platformRaw}" is not supported. Use one of: ${Array.from(ALLOWED_PLATFORMS).join(', ')}.`,
			},
			{ status: 400 }
		);
	}

	try {
		const enrichment = await creatorEnrichmentService.getCachedEnrichmentByHandle(platform, handle);
		if (!enrichment) {
			return new NextResponse(null, { status: 204 });
		}

		return NextResponse.json({ success: true, data: enrichment });
	} catch (error) {
		logger.error(
			'Failed to load cached enrichment by handle',
			error instanceof Error ? error : new Error(String(error)),
			{
				handle,
				platform,
			}
		);
		return NextResponse.json(
			{ error: 'INTERNAL_ERROR', message: 'Unexpected error loading creator enrichment.' },
			{ status: 500 }
		);
	}
}
