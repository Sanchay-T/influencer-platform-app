import { NextResponse } from 'next/server';
import { structuredConsole } from '@/lib/logging/console-proxy';

/**
 * @deprecated This endpoint is intentionally decommissioned.
 * Status monitoring/continuation now runs through canonical /api/qstash/process-search flow.
 */
export async function POST() {
	structuredConsole.warn('[QSTASH] /api/qstash/process-results is decommissioned');
	return NextResponse.json(
		{
			error: 'Endpoint decommissioned',
			replacement: '/api/qstash/process-search',
		},
		{ status: 410 }
	);
}
