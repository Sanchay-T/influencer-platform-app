import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { userSubscriptions, users } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.ONBOARDING);

export async function POST(req: Request) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { planId } = body;
		// Note: billingInterval is not stored in DB - Stripe is source of truth for billing

		if (!planId) {
			return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
		}

		// Get the user's internal UUID
		const user = await db.query.users.findFirst({
			where: eq(users.userId, userId),
			columns: { id: true },
		});

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Update user onboarding step
		await db
			.update(users)
			.set({
				onboardingStep: 'plan_selected',
				updatedAt: new Date(),
			})
			.where(eq(users.userId, userId));

		// Update or create subscription record with selected plan
		// Note: userSubscriptions.userId references users.id (UUID), not Clerk ID
		const existingSub = await db.query.userSubscriptions.findFirst({
			where: eq(userSubscriptions.userId, user.id),
		});

		if (existingSub) {
			await db
				.update(userSubscriptions)
				.set({
					intendedPlan: planId,
					updatedAt: new Date(),
				})
				.where(eq(userSubscriptions.userId, user.id));
		} else {
			await db.insert(userSubscriptions).values({
				userId: user.id,
				intendedPlan: planId,
				subscriptionStatus: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		return NextResponse.json({
			success: true,
			step: 'plan_selected',
			planId,
			message: 'Plan saved successfully',
		});
	} catch (error) {
		logger.error('Save plan error', error instanceof Error ? error : new Error(String(error)));
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
