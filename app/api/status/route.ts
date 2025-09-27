import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptionPlans, users, userSubscriptions, userUsage } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Simple test comment to verify pre-commit hook functionality
    // 🔍 DIAGNOSTIC LOGS - Environment Detection
    console.log('🔍 [STATUS-DEBUG] Environment Diagnostics:', {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_PREVIEW: process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@'),
      HAS_PASSWORD: process.env.DATABASE_URL?.includes(':') && process.env.DATABASE_URL?.includes('@'),
      CONNECTION_HOST: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0],
      ENV_FILE_LOADED: process.env.DATABASE_URL?.includes('influencer_platform_dev') ? 'YES' : 'NO'
    });
    
    console.log('🔍 [STATUS] Checking database connection...');
    
    // Test database connection
    const plans = await db.select().from(subscriptionPlans);
    console.log('✅ [STATUS] Found plans:', plans.length);

    const [{ totalUsers }] = await db
      .select({ totalUsers: sql<number>`COUNT(*)` })
      .from(users);

    const userSummaries = await db
      .select({
        userId: users.userId,
        email: users.email,
        currentPlan: userSubscriptions.currentPlan,
        onboardingStep: users.onboardingStep,
        campaignsUsed: userUsage.usageCampaignsCurrent,
        campaignsLimit: userUsage.planCampaignsLimit,
        creatorsUsed: userUsage.usageCreatorsCurrentMonth,
        creatorsLimit: userUsage.planCreatorsLimit,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userSubscriptions, eq(userSubscriptions.userId, users.id))
      .leftJoin(userUsage, eq(userUsage.userId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(25);

    console.log('✅ [STATUS] Sample users loaded:', userSummaries.length);

    const connectionString = process.env.DATABASE_URL;
    const isLocal = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');

    return NextResponse.json({
      success: true,
      database: {
        environment: isLocal ? 'LOCAL' : 'REMOTE',
        connection: connectionString?.replace(/\/\/.*@/, '//***@'),
        plans: plans.length,
        users: totalUsers,
      },
      subscriptionPlans: plans.map(p => ({
        planKey: p.planKey,
        displayName: p.displayName,
        campaignsLimit: p.campaignsLimit,
        creatorsLimit: p.creatorsLimit,
        monthlyPrice: p.monthlyPrice
      })),
      testUsers: userSummaries.map(u => ({
        userId: u.userId,
        email: u.email,
        currentPlan: u.currentPlan || 'free',
        onboardingStep: u.onboardingStep,
        campaignsUsed: u.campaignsUsed ?? 0,
        campaignsLimit: u.campaignsLimit ?? 0,
        creatorsUsed: u.creatorsUsed ?? 0,
        creatorsLimit: u.creatorsLimit ?? 0,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ [STATUS] Database error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
