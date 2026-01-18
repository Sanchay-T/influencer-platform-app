import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LogCategory, logger } from '@/lib/logging';

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function GET() {
	const startTime = Date.now();

	try {
		await db.execute(sql`select 1`);

		const durationMs = Date.now() - startTime;
		logger.debug('[status] healthcheck ok', { executionTime: durationMs }, LogCategory.SYSTEM);

		return NextResponse.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		const durationMs = Date.now() - startTime;
		logger.error(
			'[status] healthcheck failed',
			error instanceof Error ? error : new Error(String(error)),
			{ executionTime: durationMs },
			LogCategory.SYSTEM
		);

		return NextResponse.json({ status: 'error' }, { status: 500 });
	}
}
