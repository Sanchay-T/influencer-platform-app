import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

/**
 * POST /api/creators/save-bio-email
 *
 * Saves a bio-extracted email as the creator's contact email.
 * Called when user clicks "Use Bio Email" in the confirmation dialog.
 */

const logger = createCategoryLogger(LogCategory.API);

interface SaveBioEmailRequest {
	jobId: string;
	creatorId: string; // owner.id or any identifier
	email: string;
}

export async function POST(request: Request) {
	// Auth check
	let userId: string | null = null;
	try {
		const auth = await getAuthOrTest();
		userId = auth.userId ?? null;
	} catch (authError) {
		logger.error(
			'Failed to resolve auth context for save-bio-email request',
			authError instanceof Error ? authError : new Error(String(authError))
		);
		return NextResponse.json({ error: 'AUTH_RESOLUTION_FAILED' }, { status: 500 });
	}

	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse request body
	let body: SaveBioEmailRequest;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
			{ status: 400 }
		);
	}

	const { jobId, creatorId, email } = body;

	// Validate required fields
	if (!jobId || typeof jobId !== 'string') {
		return NextResponse.json(
			{ error: 'INVALID_PAYLOAD', message: 'jobId is required.' },
			{ status: 400 }
		);
	}

	if (!creatorId || typeof creatorId !== 'string') {
		return NextResponse.json(
			{ error: 'INVALID_PAYLOAD', message: 'creatorId is required.' },
			{ status: 400 }
		);
	}

	if (!email || typeof email !== 'string') {
		return NextResponse.json(
			{ error: 'INVALID_PAYLOAD', message: 'email is required.' },
			{ status: 400 }
		);
	}

	// Basic email format validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		return NextResponse.json(
			{ error: 'INVALID_PAYLOAD', message: 'Invalid email format.' },
			{ status: 400 }
		);
	}

	logger.info('Saving bio email for creator', {
		userId,
		jobId,
		creatorId,
		email,
	});

	try {
		// Update the creator in the JSONB array where owner.id matches
		// Set contact_email field to indicate this email came from bio extraction
		const _result = await db.execute(sql`
      UPDATE scraping_results
      SET creators = (
        SELECT jsonb_agg(
          CASE
            WHEN elem->'owner'->>'id' = ${creatorId}
            THEN jsonb_set(
              jsonb_set(elem, '{contact_email}', ${JSON.stringify(email)}::jsonb),
              '{email_source}', '"bio"'::jsonb
            )
            ELSE elem
          END
        )
        FROM jsonb_array_elements(creators) AS elem
      )
      WHERE job_id = ${jobId}::uuid
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(creators) AS elem
          WHERE elem->'owner'->>'id' = ${creatorId}
        )
    `);

		logger.info('Bio email saved successfully', {
			jobId,
			creatorId,
			email,
		});

		return NextResponse.json({
			success: true,
			email,
			source: 'bio',
		});
	} catch (dbError) {
		logger.error(
			'Failed to save bio email to database',
			dbError instanceof Error ? dbError : new Error(String(dbError)),
			{ jobId, creatorId }
		);

		return NextResponse.json(
			{ error: 'DATABASE_ERROR', message: 'Failed to save email.' },
			{ status: 500 }
		);
	}
}
