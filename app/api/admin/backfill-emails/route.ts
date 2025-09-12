import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { updateUserProfile } from '@/lib/db/queries/user-queries';
import { users } from '@/lib/db/schema';
import { eq, isNull, or } from 'drizzle-orm';
import { getUserEmailFromClerk } from '@/lib/email/email-service';

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, allow any authenticated user to run this (remove in production)
    console.log('⚠️ [ADMIN-BACKFILL] Running backfill as user:', userId);

    console.log('🔧 [ADMIN-BACKFILL] Starting email backfill process');

    // Find users with missing emails
    const usersWithoutEmails = await db.query.users.findMany({
      where: or(
        isNull(users.email),
        eq(users.email, '')
      )
    });

    console.log(`📊 [ADMIN-BACKFILL] Found ${usersWithoutEmails.length} users without emails`);

    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const user of usersWithoutEmails) {
      try {
        console.log(`🔍 [ADMIN-BACKFILL] Processing user: ${user.userId}`);
        const email = await getUserEmailFromClerk(user.userId);
        
        if (email) {
          await updateUserProfile(user.userId, { 
            email
          });
          
          updatedCount++;
          const result = `✅ Updated ${user.userId}: ${email}`;
          console.log(`✅ [ADMIN-BACKFILL] ${result}`);
          results.push(result);
        } else {
          const result = `⚠️ No email found for ${user.userId}`;
          console.log(`⚠️ [ADMIN-BACKFILL] ${result}`);
          results.push(result);
        }
      } catch (error) {
        errorCount++;
        const result = `❌ Failed ${user.userId}: ${error}`;
        console.error(`❌ [ADMIN-BACKFILL] ${result}`);
        results.push(result);
      }
    }

    const result = {
      totalUsers: usersWithoutEmails.length,
      updatedCount,
      errorCount,
      results,
      message: `Backfill complete: ${updatedCount} emails updated, ${errorCount} errors`
    };

    console.log('🎉 [ADMIN-BACKFILL] Backfill process completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('💥 [ADMIN-BACKFILL] Backfill process failed:', error);
    return NextResponse.json({ 
      error: 'Backfill failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}