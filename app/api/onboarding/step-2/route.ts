import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function PATCH(req: Request) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { brandDescription } = body;

		// Brand description is optional but we still update the step
		await db
			.update(users)
			.set({
				brandDescription: brandDescription?.trim() || null,
				onboardingStep: 'intent_captured',
				updatedAt: new Date(),
			})
			.where(eq(users.userId, userId));

		return NextResponse.json({
			success: true,
			step: 'intent_captured',
			message: 'Step 2 completed',
		});
	} catch (error) {
		console.error('Onboarding step 2 error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
