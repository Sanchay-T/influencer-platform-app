import { db } from '../lib/db/index.ts';
import { events, backgroundJobs } from '../lib/db/schema.ts';
import { count } from 'drizzle-orm';

console.log('🔍 [MIGRATION-TEST] Testing if event sourcing tables exist...');

try {
  // Test events table
  console.log('📊 [MIGRATION-TEST] Testing events table...');
  const eventCount = await db.select({ count: count() }).from(events);
  console.log('✅ [MIGRATION-TEST] Events table exists with', eventCount[0]?.count || 0, 'events');
  
  // Test background_jobs table  
  console.log('📊 [MIGRATION-TEST] Testing background_jobs table...');
  const jobCount = await db.select({ count: count() }).from(backgroundJobs);
  console.log('✅ [MIGRATION-TEST] Background jobs table exists with', jobCount[0]?.count || 0, 'jobs');
  
  console.log('🎉 [MIGRATION-TEST] All event sourcing tables exist and are accessible!');
  
} catch (error) {
  console.error('❌ [MIGRATION-TEST] Migration not applied or tables missing:', error);
  console.log('💡 [MIGRATION-TEST] You need to apply the database migration:');
  console.log('   1. Connect to your database console');
  console.log('   2. Run the SQL from: supabase/migrations/0011_industry_standard_event_sourcing.sql');
  console.log('   3. Or use: supabase db push (if supabase is linked)');
}

process.exit(0);