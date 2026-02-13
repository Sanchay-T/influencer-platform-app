import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getListDetail } from '@/lib/db/queries/list-queries';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

type StatusKey = 'not_started' | 'queued' | 'in_progress' | 'enriched' | 'failed' | 'skipped_limit';

function resolveStatus(item: unknown): StatusKey {
	const itemRecord = toRecord(item) ?? {};
	const customFields = toRecord(itemRecord.customFields) ?? {};
	const auto = toRecord(customFields.autoEnrichment) ?? {};
	const status = getStringProperty(auto, 'status');
	if (status === 'queued' || status === 'in_progress' || status === 'enriched') {
		return status;
	}
	if (status === 'failed' || status === 'skipped_limit') {
		return status;
	}
	const creator = toRecord(itemRecord.creator) ?? {};
	const metadata = toRecord(creator.metadata) ?? {};
	if (toRecord(metadata.enrichment)) {
		return 'enriched';
	}
	return 'not_started';
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const detail = await getListDetail(userId, id);
		const counts: Record<StatusKey, number> = {
			not_started: 0,
			queued: 0,
			in_progress: 0,
			enriched: 0,
			failed: 0,
			skipped_limit: 0,
		};

		for (const item of detail.items) {
			counts[resolveStatus(item)] += 1;
		}

		return NextResponse.json({
			listId: id,
			total: detail.items.length,
			counts,
			active: counts.queued + counts.in_progress,
			processed: counts.enriched + counts.failed + counts.skipped_limit,
			updatedAt: new Date().toISOString(),
		});
	} catch {
		return NextResponse.json({ error: 'List not found' }, { status: 404 });
	}
}
