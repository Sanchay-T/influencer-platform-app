import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import postgres from 'postgres';

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    console.log('🚀 [FAST-SEARCH] Starting search for:', query);
    
    // Use raw SQL for maximum speed
    const sql = postgres(process.env.DATABASE_URL!);
    
    try {
      const dbStartTime = Date.now();
      
      // Simple, fast query
      const users = await sql`
        SELECT 
          user_id,
          full_name,
          business_name,
          trial_start_date,
          trial_end_date,
          trial_status,
          onboarding_step,
          stripe_customer_id
        FROM user_profiles 
        WHERE 
          full_name ILIKE ${query + '%'} OR 
          full_name ILIKE ${'%' + query + '%'} OR
          user_id ILIKE ${query + '%'}
        ORDER BY created_at DESC 
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