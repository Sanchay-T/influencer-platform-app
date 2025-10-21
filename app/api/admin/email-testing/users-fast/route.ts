import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import postgres from 'postgres';
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

    console.log('🚀 [FAST-SEARCH] Starting search for:', query);
    
    // Use raw SQL for maximum speed
    const sql = postgres(process.env.DATABASE_URL!, {
      max: 1, // serverless: one pooled connection per invocation
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      connect_timeout: 5,
      prepare: false,
    });
    
    try {
      const dbStartTime = Date.now();
      
      // Simple, fast query using new normalized tables
      const users = await sql`
        SELECT 
          u.user_id,
          u.full_name,
          u.business_name,
          us.trial_start_date,
          us.trial_end_date,
          us.trial_status,
          u.onboarding_step,
          ub.stripe_customer_id
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id
        LEFT JOIN user_billing ub ON u.id = ub.user_id
        WHERE 
          u.full_name ILIKE ${query + '%'} OR 
          u.full_name ILIKE ${'%' + query + '%'} OR
          u.user_id ILIKE ${query + '%'}
        ORDER BY u.created_at DESC 
        LIMIT 5
      `;
      
      const dbTime = Date.now() - dbStartTime;
      console.log(`⚡ [FAST-SEARCH] Raw SQL query: ${dbTime}ms`);
      
      // Minimal processing
      const processStartTime = Date.now();
      const results = users.map(user => ({
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
      
      console.log(`⏱️ [FAST-SEARCH] Performance breakdown:`);
      console.log(`   • DB Query: ${dbTime}ms`);
      console.log(`   • Processing: ${processTime}ms`);
      console.log(`   • Total: ${totalTime}ms`);
      console.log(`   • Found: ${results.length} users`);
      
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
      
    } finally {
      await sql.end();
    }

  } catch (error) {
    console.error('❌ [FAST-SEARCH] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
