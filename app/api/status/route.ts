import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptionPlans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Test comment to trigger documentation sync - second test

export async function GET() {
  try {
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

    const users = await db.select().from(userProfiles);
    console.log('✅ [STATUS] Found users:', users.length);

    const connectionString = process.env.DATABASE_URL;
    const isLocal = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');

    return NextResponse.json({
      success: true,
      database: {
        environment: isLocal ? 'LOCAL' : 'REMOTE',
        connection: connectionString?.replace(/\/\/.*@/, '//***@'),
        plans: plans.length,
        users: users.length,
      },
      subscriptionPlans: plans.map(p => ({
        planKey: p.planKey,
        displayName: p.displayName,
        campaignsLimit: p.campaignsLimit,
        creatorsLimit: p.creatorsLimit,
        monthlyPrice: p.monthlyPrice
      })),
      testUsers: users.map(u => ({
        userId: u.userId,
        currentPlan: u.currentPlan,
        campaignsUsed: u.usageCampaignsCurrent,
        campaignsLimit: u.planCampaignsLimit,
        creatorsUsed: u.usageCreatorsCurrentMonth,
        creatorsLimit: u.planCreatorsLimit
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