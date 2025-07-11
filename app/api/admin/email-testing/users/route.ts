import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { ilike, or, asc, desc } from 'drizzle-orm';
import { isAdminUser } from '@/lib/auth/admin-utils';

export async function GET(req: NextRequest) {
  try {
    // Authentication check
    const { userId } = await auth();
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

    console.log('🔍 [ADMIN-SEARCH] Searching users with query:', query);

    try {
      const startTime = Date.now();
      
      // Optimized search - only select essential fields and prioritize exact matches
      const users = await db
        .select({
          user_id: userProfiles.userId,
          full_name: userProfiles.fullName,
          business_name: userProfiles.businessName,
          trial_start_date: userProfiles.trialStartDate,
          trial_end_date: userProfiles.trialEndDate,
          trial_status: userProfiles.trialStatus,
          onboarding_step: userProfiles.onboardingStep,
          stripe_customer_id: userProfiles.stripeCustomerId,
        })
        .from(userProfiles)
        .where(
          or(
            // Start-of-string matches (fastest with indexes)
            ilike(userProfiles.userId, `${query}%`),
            ilike(userProfiles.fullName, `${query}%`),
            // Contains matches (slower but necessary)
            ilike(userProfiles.fullName, `%${query}%`),
            ilike(userProfiles.businessName, `%${query}%`)
          )
        )
        .orderBy(desc(userProfiles.createdAt))
        .limit(8);

      const queryTime = Date.now() - startTime;
      console.log(`✅ [ADMIN-SEARCH] Found ${users.length} users matching "${query}" (DB query: ${queryTime}ms)`);

      // Add computed trial status
      const usersWithStatus = users.map(user => {
        let trialStatus = 'No Trial';
        let timeRemaining = 'N/A';
        
        if (user.trial_start_date && user.trial_end_date) {
          const now = new Date();
          const endDate = new Date(user.trial_end_date);
          const timeDiff = endDate.getTime() - now.getTime();
          
          if (timeDiff > 0) {
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            trialStatus = 'Active';
            timeRemaining = `${days}d ${hours}h`;
          } else {
            trialStatus = 'Expired';
            timeRemaining = 'Expired';
          }
        }

        return {
          ...user,
          computed_trial_status: trialStatus,
          time_remaining: timeRemaining
        };
      });

      // If no database results found, search Clerk
      let allUsers = usersWithStatus;
      let searchMethod = 'database';
      
      if (usersWithStatus.length === 0) {
        console.log('🔍 [ADMIN-SEARCH] No database results, searching Clerk...');
        try {
          const client = await clerkClient();
          console.log('🔍 [CLERK-SEARCH] Searching Clerk with query:', query);
          
          // Try different search approaches
          let clerkUsers;
          if (query.includes('@')) {
            // Email search
            clerkUsers = await client.users.getUserList({
              emailAddress: [query],
              limit: 10
            });
          } else {
            // Name search - get recent users and filter
            clerkUsers = await client.users.getUserList({
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
          
          console.log(`🔍 [CLERK-SEARCH] Found ${clerkUsers.data.length} Clerk users`);
          
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
          console.log(`✅ [ADMIN-SEARCH] Found ${clerkResults.length} Clerk users`);
        } catch (clerkError) {
          console.error('❌ [ADMIN-SEARCH] Clerk search error:', clerkError);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ [ADMIN-SEARCH] Total request time: ${totalTime}ms (DB: ${queryTime}ms, Processing: ${totalTime - queryTime}ms)`);

      return NextResponse.json({
        users: allUsers,
        query,
        count: allUsers.length,
        searchMethod
      });

    } catch (dbError) {
      console.error('❌ [ADMIN-SEARCH] Database query error:', dbError);
      throw dbError;
    }

  } catch (error) {
    console.error('❌ [ADMIN-SEARCH] Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}