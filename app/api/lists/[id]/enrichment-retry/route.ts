import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { getListDetail } from '@/lib/db/queries/list-queries';
import { creatorListItems } from '@/lib/db/schema';
import { resolveListItemEnrichmentStatus } from '@/lib/lists/enrichment-status';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { dispatchListEnrichmentBatches, type ListEnrichCreatorPayload } from '@/lib/lists/enrich-list-dispatch';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

type RetryMode = 'failed_only';

function parseRetryMode(value: unknown): RetryMode | null {
	const record = toRecord(value);
	const mode = getStringProperty(record ?? {}, 'mode');
	if (mode === 'failed_only') {
		return mode;
	}
	return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: listId } = await params;
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	let mode: RetryMode | null = null;
	try {
		const body = await request.json().catch(() => ({}));
		mode = parseRetryMode(body);
	} catch {
		// ignore
	}
	if (!mode) {
		return NextResponse.json({ error: 'Invalid body. Expected { mode: \"failed_only\" }.' }, { status: 400 });
	}

	try {
		const detail = await getListDetail(userId, listId);
		if (detail.list.viewerRole !== 'owner' && detail.list.viewerRole !== 'editor') {
			return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
		}
		const failedItems = detail.items.filter((item) => resolveListItemEnrichmentStatus(item) === 'failed');
		if (!failedItems.length) {
			return NextResponse.json({ ok: true, queued: 0 });
		}

		const nowIso = new Date().toISOString();
		const retryTargets: ListEnrichCreatorPayload[] = [];

		for (const item of failedItems) {
			const itemRecord = toRecord(item) ?? {};
			const itemId = getStringProperty(itemRecord, 'id');
			const creatorId = getStringProperty(itemRecord, 'creatorId');
			const customFields = toRecord(itemRecord.customFields) ?? {};
			const previousAuto = toRecord(customFields.autoEnrichment) ?? {};
			const creatorRecord = toRecord(itemRecord.creator) ?? {};
			const handle = getStringProperty(creatorRecord, 'handle');
			const externalId = getStringProperty(creatorRecord, 'externalId');
			const platformRaw = getStringProperty(creatorRecord, 'platform')?.toLowerCase();

			if (!(itemId && creatorId && handle && externalId && platformRaw)) {
				continue;
			}
			if (!(platformRaw === 'instagram' || platformRaw === 'tiktok' || platformRaw === 'youtube')) {
				continue;
			}

			retryTargets.push({
				listItemId: itemId,
				creatorId,
				handle,
				externalId,
				platform: platformRaw,
			});

			// Re-queue list-item autoEnrichment state (do this before dispatch so UI updates immediately).
			await db
				.update(creatorListItems)
				.set({
					customFields: {
						...customFields,
						autoEnrichment: {
							...previousAuto,
							status: 'queued',
							queuedAt: nowIso,
							startedAt: null,
							completedAt: null,
							lastError: null,
						},
					},
					updatedAt: new Date(),
				})
				.where(and(eq(creatorListItems.id, itemId), eq(creatorListItems.listId, listId)));
		}

		// USE2-77: Fan out retries into parallel batches
		await dispatchListEnrichmentBatches({ userId, listId, addedCreators: retryTargets });

		return NextResponse.json({ ok: true, queued: retryTargets.length });
	} catch (error) {
		structuredConsole.error('[ENRICHMENT-RETRY] failed', { listId, error });
		return NextResponse.json({ error: 'Unable to retry enrichment' }, { status: 500 });
	}
}
