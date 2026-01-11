/**
 * V2 Pipeline Test Endpoint
 *
 * Runs the v2 expanded pipeline via QStash (with AI keyword expansion).
 * Results are saved to the events table for inspection.
 *
 * POST /api/scraping/v2-test
 * Body: { platform, keywords, target, enableBio, enableExpansion }
 *
 * Trigger via QStash or direct call.
 */

import { sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { buildConfig } from '@/lib/search-engine/v2/core/config';
import { runExpandedPipeline } from '@/lib/search-engine/v2/core/parallel-pipeline';
import type { NormalizedCreator, PipelineContext } from '@/lib/search-engine/v2/core/types';
import {
	getBooleanProperty,
	getNumberProperty,
	getStringProperty,
	toRecord,
	toStringArray,
} from '@/lib/utils/type-guards';
// Import adapter to register it
import '@/lib/search-engine/v2/adapters/tiktok';

export const maxDuration = 300; // 5 minutes for Vercel (QStash handles longer)

interface TestRequest {
	platform: 'tiktok' | 'youtube' | 'instagram';
	keywords: string[];
	target: number;
	enableBio?: boolean;
	enableExpansion?: boolean;
	testId?: string;
}

function isTestPlatform(value: unknown): value is TestRequest['platform'] {
	return value === 'tiktok' || value === 'youtube' || value === 'instagram';
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST(request: NextRequest) {
	const startTime = Date.now();

	try {
		const body: unknown = await request.json();
		const bodyRecord = toRecord(body);
		const platform =
			bodyRecord && isTestPlatform(bodyRecord.platform) ? bodyRecord.platform : 'tiktok';
		const rawKeywords = bodyRecord ? toStringArray(bodyRecord.keywords) : null;
		const keywords = rawKeywords && rawKeywords.length > 0 ? rawKeywords : ['fitness'];
		const targetValue = bodyRecord ? getNumberProperty(bodyRecord, 'target') : null;
		const targetParsed = bodyRecord ? Number(bodyRecord.target) : NaN;
		const target = Number.isFinite(targetValue ?? targetParsed)
			? (targetValue ?? targetParsed)
			: 50;
		const enableBioValue = bodyRecord ? getBooleanProperty(bodyRecord, 'enableBio') : null;
		const enableExpansionValue = bodyRecord
			? getBooleanProperty(bodyRecord, 'enableExpansion')
			: null;
		const enableBio = enableBioValue ?? true;
		const enableExpansion = enableExpansionValue ?? true;
		const testIdCandidate = bodyRecord ? getStringProperty(bodyRecord, 'testId') : null;
		const testId =
			testIdCandidate && testIdCandidate.trim().length > 0
				? testIdCandidate
				: `v2-test-${Date.now()}`;

		structuredConsole.log(`[v2-test] Starting test ${testId}`, {
			platform,
			keywords,
			target,
			enableBio,
			enableExpansion,
		});

		// Build config
		const config = buildConfig(platform);
		config.enableBioEnrichment = enableBio;
		config.enableKeywordExpansion = enableExpansion;
		config.fetchTimeoutMs = 60_000; // 60s timeout per request

		// Create context
		const context: PipelineContext = {
			jobId: testId,
			userId: 'v2-test-user',
			platform,
			keywords,
			targetResults: target,
		};

		// Collect results
		const allCreators: NormalizedCreator[] = [];
		let batchCount = 0;

		// Run expanded pipeline (with AI keyword expansion)
		const result = await runExpandedPipeline(context, config, {
			onBatch: async (creators, _metrics) => {
				batchCount++;
				allCreators.push(...creators);
				structuredConsole.log(
					`[v2-test] Batch ${batchCount}: +${creators.length} creators (total: ${allCreators.length})`
				);
			},
			onProgress: async (current, targetCount, status) => {
				structuredConsole.log(`[v2-test] Progress: ${current}/${targetCount} - ${status}`);
			},
			enrichWorkers: 5,
			batchSize: 10,
		});

		const durationMs = Date.now() - startTime;

		// Build test result
		const testResult = {
			testId,
			platform,
			keywords,
			target,
			enableBio,
			enableExpansion,
			status: result.status,
			totalCreators: allCreators.length,
			keywordsUsed: result.keywordsUsed,
			expansionRuns: result.expansionRuns,
			metrics: result.metrics,
			durationMs,
			creatorsPerSecond: durationMs > 0 ? (allCreators.length / durationMs) * 1000 : 0,
			sampleCreators: allCreators.slice(0, 5).map((c) => ({
				username: c.creator.username,
				name: c.creator.name,
				followers: c.creator.followers,
				bio: c.creator.bio?.slice(0, 100),
				bioEnriched: c.bioEnriched,
				emails: c.creator.emails,
			})),
			stats: {
				withBio: allCreators.filter((c) => c.creator.bio && c.creator.bio.trim().length > 0).length,
				bioEnriched: allCreators.filter((c) => c.bioEnriched).length,
				withEmail: allCreators.filter((c) => c.creator.emails && c.creator.emails.length > 0)
					.length,
			},
			completedAt: new Date().toISOString(),
		};

		// Save to database using the events table with proper schema
		await db.execute(sql`
			INSERT INTO events (
				aggregate_id,
				aggregate_type,
				event_type,
				event_version,
				event_data,
				metadata,
				timestamp,
				processing_status,
				retry_count,
				idempotency_key,
				source_system
			) VALUES (
				${testId},
				'v2_test',
				'v2_pipeline_test',
				1,
				${JSON.stringify(testResult)}::jsonb,
				${JSON.stringify({ triggeredAt: new Date().toISOString() })}::jsonb,
				NOW(),
				'completed',
				0,
				${`v2-test-${testId}-${Date.now()}`},
				'v2_test_system'
			)
		`);

		structuredConsole.log(`[v2-test] Test ${testId} complete`, {
			creators: allCreators.length,
			keywordsUsed: result.keywordsUsed?.length,
			expansionRuns: result.expansionRuns,
			durationMs,
			status: result.status,
		});

		return NextResponse.json({
			success: true,
			testId,
			result: testResult,
		});
	} catch (error) {
		structuredConsole.error('[v2-test] Test failed:', error);

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error),
				durationMs: Date.now() - startTime,
			},
			{ status: 500 }
		);
	}
}

// GET - Retrieve test results
// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const testId = searchParams.get('testId');
	const limit = parseInt(searchParams.get('limit') || '10', 10);

	try {
		if (testId) {
			// Get specific test
			const result = await db.execute(sql`
				SELECT event_data, timestamp
				FROM events
				WHERE event_type = 'v2_pipeline_test'
				AND event_data->>'testId' = ${testId}
				ORDER BY timestamp DESC
				LIMIT 1
			`);

			if (result.length === 0) {
				return NextResponse.json({ error: 'Test not found' }, { status: 404 });
			}

			return NextResponse.json(result[0]);
		}

		// Get recent tests
		const results = await db.execute(sql`
			SELECT
				event_data->>'testId' as test_id,
				event_data->>'platform' as platform,
				event_data->>'status' as status,
				(event_data->>'totalCreators')::int as total_creators,
				(event_data->>'durationMs')::int as duration_ms,
				event_data->'stats' as stats,
				timestamp
			FROM events
			WHERE event_type = 'v2_pipeline_test'
			ORDER BY timestamp DESC
			LIMIT ${limit}
		`);

		return NextResponse.json({ tests: results });
	} catch (error) {
		structuredConsole.error('[v2-test] Failed to get results:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
}
