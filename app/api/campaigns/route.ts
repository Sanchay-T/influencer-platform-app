import { structuredConsole } from '@/lib/logging/console-proxy';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test'
import { db } from '@/lib/db'
import { campaigns, scrapingJobs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, desc, count } from 'drizzle-orm'
import { PlanValidator } from '@/lib/services/plan-validator'
import BillingLogger from '@/lib/loggers/billing-logger'

export const maxDuration = 10; // Aumentar el tiempo máximo de ejecución a 10 segundos

export async function POST(req: Request) {
  const requestId = BillingLogger.generateRequestId();
  
  try {
    await BillingLogger.logAPI(
      'REQUEST_START',
      'Campaign creation API request started',
      undefined,
      {
        endpoint: '/api/campaigns',
        method: 'POST',
        requestId
      },
      requestId
    );

    const { userId } = await getAuthOrTest();
    
    if (!userId) {
      await BillingLogger.logAPI(
        'REQUEST_ERROR',
        'Campaign creation unauthorized',
        undefined,
        {
          error: 'UNAUTHORIZED',
          requestId
        },
        requestId
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await BillingLogger.logAPI(
      'REQUEST_SUCCESS',
      'User authenticated for campaign creation',
      userId,
      { requestId },
      requestId
    );

    // 🛡️ ENHANCED PLAN VALIDATION with detailed logging
    await BillingLogger.logUsage(
      'LIMIT_CHECK',
      'Validating campaign creation limits',
      userId,
      {
        usageType: 'campaigns',
        action: 'create'
      },
      requestId
    );

    const validation = await PlanValidator.validateCampaignCreation(userId, requestId);
    
    if (!validation.allowed) {
      await BillingLogger.logAccess(
        'DENIED',
        'Campaign creation denied due to plan limits',
        userId,
        {
          resource: 'campaign_creation',
          reason: validation.reason,
          upgradeRequired: validation.upgradeRequired,
          currentUsage: validation.currentUsage,
          limit: validation.limit,
          usagePercentage: validation.usagePercentage
        },
        requestId
      );

      return NextResponse.json({ 
        error: 'Plan limit exceeded',
        message: validation.reason,
        upgrade: validation.upgradeRequired,
        currentUsage: validation.currentUsage,
        limit: validation.limit,
        usagePercentage: validation.usagePercentage,
        recommendedPlan: validation.recommendedPlan,
        warningThreshold: validation.warningThreshold
      }, { status: 403 });
    }
    
    await BillingLogger.logAccess(
      'GRANTED',
      'Campaign creation approved',
      userId,
      {
        resource: 'campaign_creation',
        currentUsage: validation.currentUsage,
        limit: validation.limit,
        usagePercentage: validation.usagePercentage,
        warningThreshold: validation.warningThreshold
      },
      requestId
    );

    // Parse request body
    const body = await req.json();
    const { name, description, searchType } = body;
    const normalizedSearchType =
      searchType === 'similar'
        ? 'similar'
        : searchType === 'keyword'
          ? 'keyword'
          : 'keyword';

    if (!searchType || !['keyword', 'similar'].includes(searchType)) {
      await BillingLogger.logAPI(
        'RESPONSE',
        'Campaign search type defaulted to keyword',
        userId,
        {
          providedType: searchType,
          requestId
        },
        requestId
      );
    }

    await BillingLogger.logAPI(
      'RESPONSE',
      'Campaign data parsed successfully',
      userId,
      {
        campaignName: name,
        searchType,
        hasDescription: !!description
      },
      requestId
    );

    // Create campaign in database
    await BillingLogger.logDatabase(
      'CREATE',
      'Creating new campaign in database',
      userId,
      {
        table: 'campaigns',
        operation: 'insert',
        data: { name, searchType: normalizedSearchType, status: 'draft' }
      },
      requestId
    );

    const [campaign] = await db.insert(campaigns).values({
      userId: userId,
      name,
      description,
      searchType: normalizedSearchType,
      status: 'draft'
    }).returning();

    await BillingLogger.logDatabase(
      'CREATE',
      'Campaign created successfully in database',
      userId,
      {
        table: 'campaigns',
        recordId: campaign.id,
        campaignName: campaign.name,
        searchType: normalizedSearchType
      },
      requestId
    );

    // 📈 ENHANCED USAGE TRACKING with detailed logging
    await BillingLogger.logUsage(
      'CAMPAIGN_CREATE',
      'Incrementing campaign usage counter',
      userId,
      {
        campaignId: campaign.id,
        campaignName: campaign.name,
        searchType: normalizedSearchType,
        usageType: 'campaigns'
      },
      requestId
    );

    await PlanValidator.incrementUsage(
      userId, 
      'campaigns', 
      1, 
      {
        campaignId: campaign.id,
        campaignName: campaign.name,
        searchType: campaign.searchType
      },
      requestId
    );

    await BillingLogger.logAPI(
      'REQUEST_SUCCESS',
      'Campaign creation completed successfully',
      userId,
      {
        campaignId: campaign.id,
        campaignName: campaign.name,
        searchType: normalizedSearchType,
        executionTime: Date.now(),
        requestId
      },
      requestId
    );

    return NextResponse.json(campaign);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await BillingLogger.logError(
      'CAMPAIGN_CREATION_ERROR',
      'Campaign creation failed',
      undefined, // userId might not be available in catch
      {
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        requestId
      },
      requestId
    );

    await BillingLogger.logAPI(
      'REQUEST_ERROR',
      'Campaign creation API request failed',
      undefined,
      {
        error: errorMessage,
        requestId
      },
      requestId
    );

    return NextResponse.json({ 
      error: 'Internal Server Error',
      requestId 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  structuredConsole.log('\n\n====== CAMPAIGNS API GET CALLED ======');
  structuredConsole.log('🔍 [CAMPAIGNS-API] GET request received at:', new Date().toISOString());
  try {
    structuredConsole.log('🔐 [CAMPAIGNS-API] Getting authenticated user from Clerk');
    const { userId } = await getAuthOrTest()
    
    if (!userId) {
      structuredConsole.error('❌ [CAMPAIGNS-API] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    structuredConsole.log('✅ [CAMPAIGNS-API] User authenticated', { userId });

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    
    structuredConsole.log('🔍 [CAMPAIGNS-API] Fetching campaigns with pagination', { page, limit, offset });

    // Realizar ambas consultas en paralelo
    structuredConsole.log('🔄 [CAMPAIGNS-API] Executing parallel database queries');
    const [totalCount, userCampaigns] = await Promise.all([
      // Consulta optimizada para contar
      db.select({ count: count() }).from(campaigns)
        .where(eq(campaigns.userId, userId))
        .then(result => result[0].count),

      // Consulta principal optimizada
      db.query.campaigns.findMany({
        where: (campaigns, { eq }) => eq(campaigns.userId, userId),
        limit: limit,
        offset: offset,
        columns: {
          id: true,
          name: true,
          description: true,
          searchType: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        with: {
          scrapingJobs: {
            limit: 1,
            orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
            columns: {
              id: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)]
      })
    ]);

    structuredConsole.log('✅ [CAMPAIGNS-API] Campaigns fetched successfully', { 
      totalCount, 
      fetchedCount: userCampaigns.length,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    });

    // Agregar cache-control headers
    const headers = new Headers();
    headers.set('Cache-Control', 's-maxage=1, stale-while-revalidate=59');

    return NextResponse.json({
      campaigns: userCampaigns,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    }, { headers });

  } catch (error: any) {
    structuredConsole.error('💥 [CAMPAIGNS-API] Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Error al cargar campañas', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
