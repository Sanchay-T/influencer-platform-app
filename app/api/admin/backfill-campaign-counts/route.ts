import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/backend-auth';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { eq, count } from 'drizzle-orm';

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
    console.log('⚠️ [ADMIN-BACKFILL] Running campaign count backfill as user:', userId);

    console.log('🔧 [ADMIN-BACKFILL] Starting campaign count backfill process');

    // Get all users who have campaigns
    const usersWithCampaigns = await db
      .select({ 
        userId: campaigns.userId,
        campaignCount: count()
      })
      .from(campaigns)
      .groupBy(campaigns.userId);

    console.log(`📊 [ADMIN-BACKFILL] Found ${usersWithCampaigns.length} users with campaigns`);

    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const userCampaignData of usersWithCampaigns) {
      try {
        console.log(`🔍 [ADMIN-BACKFILL] Processing user: ${userCampaignData.userId} with ${userCampaignData.campaignCount} campaigns`);
        
        // Get current usage count from database
        const userProfile = await getUserProfile(userCampaignData.userId);

        if (!userProfile) {
          const result = `⚠️ No user profile found for ${userCampaignData.userId}`;
          console.log(`⚠️ [ADMIN-BACKFILL] ${result}`);
          results.push(result);
          continue;
        }

        const currentUsage = userProfile.usageCampaignsCurrent || 0;
        const actualCount = userCampaignData.campaignCount;

        if (currentUsage !== actualCount) {
          // Update the usage count to match actual campaign count
          await updateUserProfile(userCampaignData.userId, {
            usageCampaignsCurrent: actualCount,
          });
          
          updatedCount++;
          const result = `✅ Updated ${userCampaignData.userId}: ${currentUsage} → ${actualCount} campaigns`;
          console.log(`✅ [ADMIN-BACKFILL] ${result}`);
          results.push(result);
        } else {
          const result = `✓ Skipped ${userCampaignData.userId}: already correct (${actualCount} campaigns)`;
          console.log(`✓ [ADMIN-BACKFILL] ${result}`);
          results.push(result);
        }
      } catch (error) {
        errorCount++;
        const result = `❌ Failed ${userCampaignData.userId}: ${error}`;
        console.error(`❌ [ADMIN-BACKFILL] ${result}`);
        results.push(result);
      }
    }

    const result = {
      totalUsers: usersWithCampaigns.length,
      updatedCount,
      errorCount,
      results,
      message: `Campaign count backfill complete: ${updatedCount} users updated, ${errorCount} errors`
    };

    console.log('🎉 [ADMIN-BACKFILL] Campaign count backfill process completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('💥 [ADMIN-BACKFILL] Campaign count backfill process failed:', error);
    return NextResponse.json({ 
      error: 'Campaign count backfill failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}