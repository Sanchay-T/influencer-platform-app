import { Receiver } from '@upstash/qstash';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creatorListItems } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { PlanLimitExceededError, creatorEnrichmentService } from '@/lib/services/creator-enrichment';
import { getStringProperty, toArray, toRecord } from '@/lib/utils/type-guards';

const receiver = new Receiver({
	currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
	nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

type AutoEnrichmentStatus = 'queued' | 'in_progress' | 'enriched' | 'failed' | 'skipped_limit';

type AddedCreatorPayload = {
	listItemId: string;
	creatorId: string;
	handle: string;
	platform: 'instagram' | 'tiktok' | 'youtube';
	externalId?: string;
};

function shouldVerifySignature() {
	if (process.env.NODE_ENV === 'development') {
		return process.env.VERIFY_QSTASH_SIGNATURE === 'true';
	}
	if (process.env.SKIP_QSTASH_SIGNATURE === 'true') {
		return false;
	}
	return true;
}

const isSupportedPlatform = (value: string): value is AddedCreatorPayload['platform'] =>
	value === 'instagram' || value === 'tiktok' || value === 'youtube';

function parsePayload(raw: string): { userId: string; listId: string; addedCreators: AddedCreatorPayload[] } {
	const parsed = JSON.parse(raw);
	const record = toRecord(parsed);
	const userId = getStringProperty(record ?? {}, 'userId');
	const listId = getStringProperty(record ?? {}, 'listId');
	const rawCreators = toArray(record?.addedCreators) ?? [];

	if (!(userId && listId)) {
		throw new Error('Invalid payload: userId and listId required');
	}

	const addedCreators = rawCreators.reduce<AddedCreatorPayload[]>((acc, entry) => {
			const creator = toRecord(entry);
			const listItemId = getStringProperty(creator ?? {}, 'listItemId');
			const creatorId = getStringProperty(creator ?? {}, 'creatorId');
			const handle = getStringProperty(creator ?? {}, 'handle');
			const platformRaw = getStringProperty(creator ?? {}, 'platform')?.toLowerCase();
			const externalId = getStringProperty(creator ?? {}, 'externalId');

			if (!(listItemId && creatorId && handle && platformRaw && isSupportedPlatform(platformRaw))) {
				return acc;
			}

			acc.push({
				listItemId,
				creatorId,
				handle,
				platform: platformRaw,
				externalId: externalId ?? undefined,
			});
			return acc;
		}, []);

	return { userId, listId, addedCreators };
}

async function updateListItemStatus(
	listId: string,
	listItemId: string,
	status: AutoEnrichmentStatus,
	extra: Record<string, unknown> = {}
) {
	const existing = await db.query.creatorListItems.findFirst({
		where: and(eq(creatorListItems.id, listItemId), eq(creatorListItems.listId, listId)),
		columns: { customFields: true },
	});

	if (!existing) {
		return;
	}

	const customFields = toRecord(existing.customFields) ?? {};
	const previousAuto = toRecord(customFields.autoEnrichment) ?? {};

	await db
		.update(creatorListItems)
		.set({
			customFields: {
				...customFields,
				autoEnrichment: {
					...previousAuto,
					status,
					...extra,
				},
			},
			updatedAt: new Date(),
		})
		.where(and(eq(creatorListItems.id, listItemId), eq(creatorListItems.listId, listId)));
}

export async function POST(request: Request) {
	const rawBody = await request.text();
	const signature = request.headers.get('Upstash-Signature');

	if (shouldVerifySignature()) {
		if (!signature) {
			return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
		}
		const host = request.headers.get('host') || process.env.VERCEL_URL || '';
		const protocol = host.includes('localhost') ? 'http' : 'https';
		const base = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL;
		const callbackUrl = `${base}/api/qstash/auto-enrich-list-items`;
		const valid = await receiver.verify({ signature, body: rawBody, url: callbackUrl });
		if (!valid) {
			return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
		}
	}

	try {
		const { userId, listId, addedCreators } = parsePayload(rawBody);
		if (!addedCreators.length) {
			return NextResponse.json({ ok: true, processed: 0 });
		}

		// USE2-77: Process creators in parallel within each batch (configurable concurrency)
		const MAX_PARALLEL = Math.max(1, parseInt(process.env.LIST_ENRICH_MAX_PARALLEL || '3', 10) || 3);
		let processed = 0;
		let planLimitHit = false;

		// Process in chunks of MAX_PARALLEL concurrent enrichments
		for (let i = 0; i < addedCreators.length; i += MAX_PARALLEL) {
			if (planLimitHit) {
				// Mark remaining creators as skipped
				for (const remaining of addedCreators.slice(i)) {
					await updateListItemStatus(listId, remaining.listItemId, 'skipped_limit', {
						completedAt: new Date().toISOString(),
						lastError: 'Plan limit reached',
					});
				}
				break;
			}

			const chunk = addedCreators.slice(i, i + MAX_PARALLEL);

			// Mark all in chunk as in_progress
			await Promise.allSettled(
				chunk.map((creator) =>
					updateListItemStatus(listId, creator.listItemId, 'in_progress', {
						startedAt: new Date().toISOString(),
						lastError: null,
						attempts: 1,
					})
				)
			);

			// Enrich all creators in chunk concurrently
			const results = await Promise.allSettled(
				chunk.map(async (creator) => {
					await creatorEnrichmentService.enrichCreator({
						userId,
						creatorId: creator.creatorId,
						handle: creator.handle,
						platform: creator.platform,
						externalId: creator.externalId,
						forceRefresh: false,
					});
					return creator;
				})
			);

			// Process results
			for (const [index, result] of results.entries()) {
				const creator = chunk[index];
				if (result.status === 'fulfilled') {
					await updateListItemStatus(listId, creator.listItemId, 'enriched', {
						completedAt: new Date().toISOString(),
					});
					processed += 1;
				} else {
					const error = result.reason;
					if (error instanceof PlanLimitExceededError) {
						planLimitHit = true;
						await updateListItemStatus(listId, creator.listItemId, 'skipped_limit', {
							completedAt: new Date().toISOString(),
							lastError: 'Plan limit reached',
						});
					} else {
						await updateListItemStatus(listId, creator.listItemId, 'failed', {
							completedAt: new Date().toISOString(),
							lastError: error instanceof Error ? error.message : 'Enrichment failed',
						});
						structuredConsole.error('[AUTO_ENRICH_QSTASH] creator enrich failed', {
							listId,
							listItemId: creator.listItemId,
							error,
						});
					}
				}
			}
		}

		return NextResponse.json({ ok: true, processed, total: addedCreators.length });
	} catch (error) {
		structuredConsole.error('[AUTO_ENRICH_QSTASH] invalid payload', error);
		const message = error instanceof Error ? error.message : 'Failed to process payload';
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
