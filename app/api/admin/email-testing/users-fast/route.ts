import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { users, userSubscriptions, userBilling } from '@/lib/db/schema';
import { eq, or, desc, sql } from 'drizzle-orm';
import { isAdminUser } from '@/lib/auth/admin-utils';

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Authentication check
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    const isAdmin = await isAdminUser();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    structuredConsole.log('🚀 [FAST-SEARCH] Starting search for:', query);

    const dbStartTime = Date.now();

    // Fast query using shared connection pool
    const queryPatternStart = `${query}%`;
    const queryPatternContains = `%${query}%`;
    const dbUsers = await db
      .select({
        user_id: users.userId,
        full_name: users.fullName,
        business_name: users.businessName,
        trial_start_date: userSubscriptions.trialStartDate,
        trial_end_date: userSubscriptions.trialEndDate,
        trial_status: userSubscriptions.trialStatus,
        onboarding_step: users.onboardingStep,
        stripe_customer_id: userBilling.stripeCustomerId,
        created_at: users.createdAt,
      })
      .from(users)
      .leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
      .leftJoin(userBilling, eq(users.id, userBilling.userId))
      .where(
        or(
          sql`${users.fullName} ILIKE ${queryPatternStart}`,
          sql`${users.fullName} ILIKE ${queryPatternContains}`,
          sql`${users.userId} ILIKE ${queryPatternStart}`
        )
      )
      .orderBy(desc(users.createdAt))
      .limit(5);

    const dbTime = Date.now() - dbStartTime;
    structuredConsole.log(`⚡ [FAST-SEARCH] Drizzle query: ${dbTime}ms`);

    // Minimal processing
    const processStartTime = Date.now();
    const results = dbUsers.map(user => ({
      user_id: user.user_id,
      full_name: user.full_name,
      business_name: user.business_name,
      trial_status: user.trial_status,
      onboarding_step: user.onboarding_step,
      stripe_customer_id: user.stripe_customer_id,
      computed_trial_status: user.trial_status === 'active' ? 'Active' : 'No Trial'
    }));

    const processTime = Date.now() - processStartTime;
    const totalTime = Date.now() - startTime;

    structuredConsole.log(`⏱️ [FAST-SEARCH] Performance breakdown:`);
    structuredConsole.log(`   • DB Query: ${dbTime}ms`);
    structuredConsole.log(`   • Processing: ${processTime}ms`);
    structuredConsole.log(`   • Total: ${totalTime}ms`);
    structuredConsole.log(`   • Found: ${results.length} users`);

    return NextResponse.json({
      users: results,
      query,
      count: results.length,
      performance: {
        dbTime,
        processTime,
        totalTime
      }
    });

  } catch (error) {
    structuredConsole.error('❌ [FAST-SEARCH] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
