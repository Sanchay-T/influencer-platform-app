import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { LogCategory, logger } from '@/lib/logging';

function sanitizeDatabaseUrl(raw: string | null): { host: string | null; database: string | null } {
	if (!raw) {
		return { host: null, database: null };
	}
	try {
		const url = new URL(raw);
		return {
			host: url.host,
			database: url.pathname.replace(/^\//, '') || null,
		};
	} catch {
		return { host: 'unparseable', database: 'unparseable' };
	}
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function GET(req: Request) {
	const vercelId = req.headers.get('x-vercel-id') ?? req.headers.get('x-vercel-trace');

	try {
		const auth = await getAuthOrTest();
		if (!auth.userId) {
			return NextResponse.json({ error: 'Unauthorized', vercelId }, { status: 401 });
		}

		const info = sanitizeDatabaseUrl(process.env.DATABASE_URL ?? null);

		const rows = await db.execute<{
			columnName: string;
		}>(sql`
			select column_name as "columnName"
			from information_schema.columns
			where table_schema = 'public'
				and table_name = 'scraping_jobs'
				and column_name in (
					'keywords_dispatched',
					'keywords_completed',
					'creators_found',
					'creators_enriched',
					'enrichment_status',
					'expansion_round',
					'used_keywords'
				)
			order by column_name;
		`);

		const present = Array.isArray(rows) ? rows.map((r) => r.columnName) : [];
		const hasKeywordsDispatched = present.includes('keywords_dispatched');

		logger.info(
			'[debug/db-schema] scraping_jobs schema check',
			{
				userId: auth.userId,
				vercelId,
				host: info.host,
				database: info.database,
				hasKeywordsDispatched,
				present,
			},
			LogCategory.API
		);

		return NextResponse.json(
			{
				ok: true,
				vercelId,
				db: info,
				scrapingJobs: {
					hasKeywordsDispatched,
					present,
				},
			},
			{ status: 200 }
		);
	} catch (error) {
		logger.error(
			'[debug/db-schema] failed',
			error instanceof Error ? error : new Error(String(error)),
			{ vercelId },
			LogCategory.API
		);

		return NextResponse.json(
			{
				error: 'DB_SCHEMA_DEBUG_FAILED',
				message: error instanceof Error ? error.message : String(error),
				vercelId,
			},
			{ status: 500 }
		);
	}
}
