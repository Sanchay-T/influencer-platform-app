import { structuredConsole } from '@/lib/logging/console-proxy';
import '@/lib/config/load-env';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import postgres from 'postgres';
import { isAdminUser } from '@/lib/auth/admin-utils';

// In-memory cache for user search results
const userCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ users: [], cached: false, query: null });
    }
    const startTime = Date.now();
    
    // Authentication check
    const { userId } = await getAuthOrTest();
    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json({ users: [], cached: false, query: null });
    }

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

    // Check cache first
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = userCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      structuredConsole.log(`⚡ [CACHED-SEARCH] Cache hit for "${query}" (${Date.now() - startTime}ms)`);
      return NextResponse.json({
        users: cached.data,
        query,
        count: cached.data.length,
        cached: true
      });
    }

    structuredConsole.log(`🔍 [CACHED-SEARCH] Cache miss, fetching for: ${query}`);
    
    const sql = postgres(process.env.DATABASE_URL!, {
      max: 1,
      connect_timeout: 5,
      prepare: false,
    });
    
    try {
      const dbStartTime = Date.now();
      
      // Fast query with minimal data using new normalized tables
      const users = await sql`
        SELECT 
          u.user_id,
          u.full_name,
          u.business_name,
          us.trial_status,
          u.onboarding_step
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id
        WHERE 
          u.full_name ILIKE ${query + '%'} OR 
          u.user_id ILIKE ${query + '%'}
        ORDER BY 
          CASE WHEN u.full_name ILIKE ${query + '%'} THEN 0 ELSE 1 END,
          u.created_at DESC 
        LIMIT 5
      `;
      
      const dbTime = Date.now() - dbStartTime;
      
      // Minimal processing
      const results = users.map(user => ({
        user_id: user.user_id,
        full_name: user.full_name,
        business_name: user.business_name,
        trial_status: user.trial_status,
        onboarding_step: user.onboarding_step,
        computed_trial_status: user.trial_status === 'active' ? 'Active' : 'No Trial'
      }));
      
      // Cache the results
      userCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });
      
      // Clean old cache entries (simple cleanup)
      if (userCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of userCache.entries()) {
          if (now - value.timestamp > CACHE_TTL) {
            userCache.delete(key);
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      structuredConsole.log(`⚡ [CACHED-SEARCH] Fresh data: ${totalTime}ms (DB: ${dbTime}ms)`);
      
      return NextResponse.json({
        users: results,
        query,
        count: results.length,
        cached: false,
        dbTime,
        totalTime
      });
      
    } finally {
      await sql.end();
    }

  } catch (error) {
    structuredConsole.error('❌ [CACHED-SEARCH] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
