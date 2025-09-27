/**
 * Database Migration: Clean Test Subscriptions
 * Automatically removes test subscription references when running in production
 */

export async function cleanTestSubscriptionsInProduction() {
  // Only run in production environment
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  
  if (!isProduction) {
    console.log('[MIGRATION] Skipping test subscription cleanup - not in production');
    return;
  }
  
  console.log('[MIGRATION] CLEANUP Starting test subscription cleanup for production...');
  
  try {
    // Dynamic import to avoid loading in test environments
    const { Client } = await import('pg');
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    // Find all test subscriptions
    const findTestSubsQuery = `
      SELECT id, user_id, stripe_subscription_id, stripe_customer_id, current_plan
      FROM user_profiles 
      WHERE stripe_subscription_id LIKE 'sub_1Rm%'
         OR stripe_subscription_id LIKE '%test%'
         OR stripe_customer_id LIKE '%test%'
         OR stripe_customer_id LIKE 'cus_test_%';
    `;
    
    const testSubs = await client.query(findTestSubsQuery);
    
    if (testSubs.rows.length > 0) {
      console.log(`[MIGRATION] FIND Found ${testSubs.rows.length} test subscriptions to clean:`);
      
      testSubs.rows.forEach(row => {
        console.log(`   User: ${row.user_id} | Plan: ${row.current_plan} | Sub: ${row.stripe_subscription_id}`);
      });
      
      // Clean all test subscriptions
      const cleanQuery = `
        UPDATE user_profiles 
        SET 
          stripe_subscription_id = NULL,
          stripe_customer_id = NULL,
          subscription_status = NULL,
          updated_at = NOW()
        WHERE stripe_subscription_id LIKE 'sub_1Rm%'
           OR stripe_subscription_id LIKE '%test%'
           OR stripe_customer_id LIKE '%test%'
           OR stripe_customer_id LIKE 'cus_test_%'
        RETURNING user_id, current_plan;
      `;
      
      const cleanResult = await client.query(cleanQuery);
      
      console.log(`[MIGRATION][OK] Cleaned ${cleanResult.rows.length} test subscriptions`);
      console.log('[MIGRATION] RESULT Users can now create new live subscriptions');
      
      // Log the cleanup for audit purposes
      cleanResult.rows.forEach(row => {
        console.log(`   [MIGRATION][OK] Cleaned user: ${row.user_id} (${row.current_plan})`);
      });
      
    } else {
      console.log('[MIGRATION][OK] No test subscriptions found - database is clean');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('[MIGRATION][FAIL] Failed to clean test subscriptions:', error.message);
    
    // Don't fail the app startup, just log the error
    console.log('[MIGRATION][WARN] App will continue, but manual cleanup may be needed');
  }
  
  console.log('[MIGRATION] COMPLETE [MIGRATION] Test subscription cleanup complete');
}

// Auto-run on import if in production
if (typeof window === 'undefined') { // Server-side only
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  
  if (isProduction) {
    cleanTestSubscriptionsInProduction().catch(error => {
      console.error('[MIGRATION][FAIL] Error in auto-cleanup:', error.message);
    });
  }
}