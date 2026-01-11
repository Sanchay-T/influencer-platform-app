import { NextResponse } from 'next/server';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { CreatorNotFoundError, creatorEnrichmentService } from '@/lib/services/creator-enrichment';

// Breadcrumb: GET /api/creators/[id]/enriched-data -> fetch stored enrichment metadata for dashboards & CLI tests.

const logger = createCategoryLogger(LogCategory.API);

interface RouteParams {
	params: Promise<{
		id: string;
	}>;
}

export async function GET(_: Request, { params }: RouteParams) {
	const resolvedParams = await params;
	const creatorId = resolvedParams?.id;

	if (!creatorId) {
		return NextResponse.json({ error: 'CREATOR_ID_REQUIRED' }, { status: 400 });
	}

	let userId: string | null = null;
	try {
		const auth = await getAuthOrTest();
		userId = auth.userId ?? null;
	} catch (authError) {
		logger.error(
			'Failed to resolve auth context for enrichment lookup',
			authError instanceof Error ? authError : new Error(String(authError))
		);
		return NextResponse.json({ error: 'AUTH_RESOLUTION_FAILED' }, { status: 500 });
	}

	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const enrichment = await creatorEnrichmentService.getCachedEnrichment(creatorId);

		if (!enrichment) {
			return NextResponse.json({ error: 'ENRICHMENT_NOT_FOUND' }, { status: 404 });
		}

		return NextResponse.json({ success: true, data: enrichment });
	} catch (error) {
		if (error instanceof CreatorNotFoundError) {
			return NextResponse.json(
				{ error: 'CREATOR_NOT_FOUND', message: error.message },
				{ status: 404 }
			);
		}

		logger.error(
			'Failed to load cached enrichment',
			error instanceof Error ? error : new Error(String(error)),
			{
				creatorId,
				userId,
			}
		);

		return NextResponse.json(
			{ error: 'INTERNAL_ERROR', message: 'Unexpected error loading creator enrichment.' },
			{ status: 500 }
		);
	}
}
