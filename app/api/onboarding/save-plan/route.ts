import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { userSubscriptions, users } from '@/lib/db/schema';

export async function POST(req: Request) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { planId, billingInterval } = body;

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
					billingInterval: billingInterval || 'monthly',
					updatedAt: new Date(),
				})
				.where(eq(userSubscriptions.userId, user.id));
		} else {
			await db.insert(userSubscriptions).values({
				userId: user.id,
				intendedPlan: planId,
				billingInterval: billingInterval || 'monthly',
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
		console.error('Save plan error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
