import { structuredConsole } from '@/lib/logging/console-proxy';
import '@/lib/config/load-env';
import { NextRequest, NextResponse } from 'next/server';
import { clerkBackendClient } from '@/lib/auth/backend-auth';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ilike, or, asc, desc } from 'drizzle-orm';
import { isAdminUser } from '@/lib/auth/admin-utils';

export async function GET(req: NextRequest) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ users: [], query: null, count: 0, searchMethod: 'skipped' });
    }
    // Authentication check
    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json({ users: [], query: null, count: 0, searchMethod: 'skipped' });
    }

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

    structuredConsole.log('🔍 [ADMIN-SEARCH] Searching users with query:', query);

    try {
      const startTime = Date.now();
      
      // Optimized search - only select essential fields and prioritize exact matches
      const userResults = await db
        .select({
          user_id: users.userId,
          full_name: users.fullName,
          business_name: users.businessName,
          onboarding_step: users.onboardingStep,
        })
        .from(users)
        .where(
          or(
            // Start-of-string matches (fastest with indexes)
            ilike(users.userId, `${query}%`),
            ilike(users.fullName, `${query}%`),
            // Contains matches (slower but necessary)
            ilike(users.fullName, `%${query}%`),
            ilike(users.businessName, `%${query}%`)
          )
        )
        .orderBy(desc(users.createdAt))
        .limit(8);

      const queryTime = Date.now() - startTime;
      structuredConsole.log(`✅ [ADMIN-SEARCH] Found ${userResults.length} users matching "${query}" (DB query: ${queryTime}ms)`);

      // Add computed trial status
      const usersWithStatus = userResults.map(user => {
        // Simplified status for normalized schema
        return {
          ...user,
          trial_start_date: null,
          trial_end_date: null,
          trial_status: null,
          stripe_customer_id: null,
          computed_trial_status: 'Profile Only',
          time_remaining: 'N/A'
        };
      });

      // If no database results found, search Clerk
      let allUsers = usersWithStatus;
      let searchMethod = 'database';
      
      if (usersWithStatus.length === 0) {
        structuredConsole.log('🔍 [ADMIN-SEARCH] No database results, searching Clerk...');
        try {
          structuredConsole.log('🔍 [CLERK-SEARCH] Searching Clerk with query:', query);
          
          // Try different search approaches
          let clerkUsers;
          if (query.includes('@')) {
            // Email search
            clerkUsers = await clerkBackendClient.users.getUserList({
              emailAddress: [query],
              limit: 10
            });
          } else {
            // Name search - get recent users and filter
            clerkUsers = await clerkBackendClient.users.getUserList({
              limit: 50,
              orderBy: '-created_at'
            });
            
            // Filter by name
            clerkUsers.data = clerkUsers.data.filter(user => {
              const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
              return fullName.includes(query.toLowerCase()) ||
                     (user.firstName && user.firstName.toLowerCase().includes(query.toLowerCase())) ||
                     (user.lastName && user.lastName.toLowerCase().includes(query.toLowerCase()));
            });
          }
          
          structuredConsole.log(`🔍 [CLERK-SEARCH] Found ${clerkUsers.data.length} Clerk users`);
          
          const clerkResults = clerkUsers.data.map(user => ({
            user_id: user.id,
            full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            business_name: null,
            trial_start_date: null,
            trial_end_date: null,
            trial_status: null,
            onboarding_step: null,
            stripe_customer_id: null,
            computed_trial_status: 'No Profile',
            time_remaining: 'N/A',
            email: user.emailAddresses[0]?.emailAddress,
            source: 'clerk'
          }));
          
          allUsers = clerkResults;
          searchMethod = 'clerk';
          structuredConsole.log(`✅ [ADMIN-SEARCH] Found ${clerkResults.length} Clerk users`);
        } catch (clerkError) {
          structuredConsole.error('❌ [ADMIN-SEARCH] Clerk search error:', clerkError);
        }
      }

      const totalTime = Date.now() - startTime;
      structuredConsole.log(`⏱️ [ADMIN-SEARCH] Total request time: ${totalTime}ms (DB: ${queryTime}ms, Processing: ${totalTime - queryTime}ms)`);

      return NextResponse.json({
        users: allUsers,
        query,
        count: allUsers.length,
        searchMethod
      });

    } catch (dbError) {
      structuredConsole.error('❌ [ADMIN-SEARCH] Database query error:', dbError);
      throw dbError;
    }

  } catch (error) {
    structuredConsole.error('❌ [ADMIN-SEARCH] Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
