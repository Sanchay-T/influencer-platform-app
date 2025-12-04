import { eq, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { updateUserProfile } from '@/lib/db/queries/user-queries';
import { users } from '@/lib/db/schema';
import { getUserEmailFromClerk } from '@/lib/email/email-service';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function GET() {
	return POST();
}

export async function POST() {
	try {
		const { userId } = await getAuthOrTest();

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// For now, allow any authenticated user to run this (remove in production)
		structuredConsole.log('⚠️ [ADMIN-BACKFILL] Running backfill as user:', userId);

		structuredConsole.log('🔧 [ADMIN-BACKFILL] Starting email backfill process');

		// Find users with missing emails
		const usersWithoutEmails = await db.query.users.findMany({
			where: or(isNull(users.email), eq(users.email, '')),
		});

		structuredConsole.log(
			`📊 [ADMIN-BACKFILL] Found ${usersWithoutEmails.length} users without emails`
		);

		let updatedCount = 0;
		let errorCount = 0;
		const results = [];

		for (const user of usersWithoutEmails) {
			try {
				structuredConsole.log(`🔍 [ADMIN-BACKFILL] Processing user: ${user.userId}`);
				const email = await getUserEmailFromClerk(user.userId);

				if (email) {
					await updateUserProfile(user.userId, {
						email,
					});

					updatedCount++;
					const result = `✅ Updated ${user.userId}: ${email}`;
					structuredConsole.log(`✅ [ADMIN-BACKFILL] ${result}`);
					results.push(result);
				} else {
					const result = `⚠️ No email found for ${user.userId}`;
					structuredConsole.log(`⚠️ [ADMIN-BACKFILL] ${result}`);
					results.push(result);
				}
			} catch (error) {
				errorCount++;
				const result = `❌ Failed ${user.userId}: ${error}`;
				structuredConsole.error(`❌ [ADMIN-BACKFILL] ${result}`);
				results.push(result);
			}
		}

		const result = {
			totalUsers: usersWithoutEmails.length,
			updatedCount,
			errorCount,
			results,
			message: `Backfill complete: ${updatedCount} emails updated, ${errorCount} errors`,
		};

		structuredConsole.log('🎉 [ADMIN-BACKFILL] Backfill process completed:', result);

		return NextResponse.json(result);
	} catch (error) {
		structuredConsole.error('💥 [ADMIN-BACKFILL] Backfill process failed:', error);
		return NextResponse.json(
			{
				error: 'Backfill failed',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
