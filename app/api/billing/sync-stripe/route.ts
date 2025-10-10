import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/backend-auth';
import { BillingService } from '@/lib/services/billing-service';

/**
 * ENTERPRISE PATTERN: Billing Reconciliation Endpoint
 * 
 * This is how companies like Notion, Linear, and Vercel handle webhook failures:
 * - User action triggers sync
 * - App fetches real state from Stripe
 * - Updates local database to match
 * - Returns updated state to frontend
 * 
 * Used when:
 * - Webhooks fail or are delayed
 * - User reports billing inconsistencies
 * - Periodic reconciliation jobs
 */
export async function POST(request: NextRequest) {
  try {
    const startedAt = Date.now();
    const reqId = `sync_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`🔄 [BILLING-SYNC:${reqId}] Using central billing service for reconciliation`);

    // Get current user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ★★★ CENTRAL BILLING SERVICE - Reconciliation ★★★
    const result = await BillingService.reconcileWithStripe(userId);
    
    console.log(`✅ [BILLING-SYNC:${reqId}] Central service result:`, {
      updated: result.updated,
      changes: result.changes,
      currentPlan: result.finalState.currentPlan,
      isActive: result.finalState.isActive
    });

    if (result.updated) {
      return NextResponse.json({
        success: true,
        updated: true,
        changes: result.changes,
        message: 'Billing status synced with Stripe',
        finalState: {
          currentPlan: result.finalState.currentPlan,
          subscriptionStatus: result.finalState.subscriptionStatus,
          isActive: result.finalState.isActive,
          usage: result.finalState.usage
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        updated: false,
        message: 'Billing status already synchronized',
        finalState: {
          currentPlan: result.finalState.currentPlan,
          subscriptionStatus: result.finalState.subscriptionStatus,
          isActive: result.finalState.isActive,
          usage: result.finalState.usage
        }
      });
    }

  } catch (error) {
    console.error(`❌ [BILLING-SYNC] Error syncing with Stripe:`, error);
    return NextResponse.json({
      error: 'Failed to sync billing status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// All logic now handled by central BillingService