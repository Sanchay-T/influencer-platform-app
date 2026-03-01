import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getListDetail } from '@/lib/db/queries/list-queries';
import { summarizeListEnrichment } from '@/lib/lists/enrichment-status';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const detail = await getListDetail(userId, id);
		const { total, counts, active, processed } = summarizeListEnrichment(detail.items);

		return NextResponse.json({
			listId: id,
			total,
			counts,
			active,
			processed,
			updatedAt: new Date().toISOString(),
		});
	} catch {
		return NextResponse.json({ error: 'List not found' }, { status: 404 });
	}
}
