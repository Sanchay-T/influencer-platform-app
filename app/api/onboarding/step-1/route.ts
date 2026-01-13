import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { createUser } from '@/lib/db/queries/user-queries';
import { users } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { createPerfLogger } from '@/lib/utils/perf-logger';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.ONBOARDING);

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
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
		const record = toRecord(body);
		const fullName = record ? getStringProperty(record, 'fullName') : null;
		const businessName = record ? getStringProperty(record, 'businessName') : null;
		const industry = record ? getStringProperty(record, 'industry') : null;

		if (!(fullName?.trim() && businessName?.trim())) {
			return NextResponse.json(
				{ error: 'Full name and business name are required' },
				{ status: 400 }
			);
		}

		const existingUser = await db.query.users.findFirst({
			where: eq(users.userId, userId),
			columns: { id: true },
		});

		if (existingUser) {
			// Update user profile
			await db
				.update(users)
				.set({
					fullName: fullName.trim(),
					businessName: businessName.trim(),
					industry: industry?.trim() || null,
					onboardingStep: 'info_captured',
					updatedAt: new Date(),
				})
				.where(eq(users.userId, userId));
		} else {
			await createUser({
				userId,
				fullName: fullName.trim(),
				businessName: businessName.trim(),
				industry: industry?.trim() || undefined,
				onboardingStep: 'info_captured',
			});
		}
		perf.log('db-update');

		perf.end();
		return NextResponse.json({
			success: true,
			step: 'info_captured',
			message: 'Step 1 completed',
		});
	} catch (error) {
		perf.end();
		logger.error(
			'Onboarding step 1 error',
			error instanceof Error ? error : new Error(String(error))
		);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
