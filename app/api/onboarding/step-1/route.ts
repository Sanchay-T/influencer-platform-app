import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { createPerfLogger } from '@/lib/utils/perf-logger';

const logger = createCategoryLogger(LogCategory.ONBOARDING);

export async function PATCH(req: Request) {
	const perf = createPerfLogger('onboarding/step-1');
	try {
		perf.log('start');
		const { userId } = await getAuthOrTest();
		perf.log('auth');

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		perf.log('parse-body');
		const { fullName, businessName } = body;

		if (!(fullName?.trim() && businessName?.trim())) {
			return NextResponse.json(
				{ error: 'Full name and business name are required' },
				{ status: 400 }
			);
		}

		// Update user profile
		await db
			.update(users)
			.set({
				fullName: fullName.trim(),
				businessName: businessName.trim(),
				onboardingStep: 'info_captured',
				updatedAt: new Date(),
			})
			.where(eq(users.userId, userId));
		perf.log('db-update');

		perf.end();
		return NextResponse.json({
			success: true,
			step: 'info_captured',
			message: 'Step 1 completed',
		});
	} catch (error) {
		perf.end();
		logger.error('Onboarding step 1 error', error instanceof Error ? error : new Error(String(error)));
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
