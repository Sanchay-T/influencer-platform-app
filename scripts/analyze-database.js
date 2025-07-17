#!/usr/bin/env node

/**
 * Database Analysis Script
 * 
 * This script analyzes the current database structure and billing state to understand:
 * 1. Current table schemas and field types
 * 2. Existing user profiles and their billing status
 * 3. Plan distribution and inconsistencies
 * 4. Database size and data integrity
 * 
 * Usage: node scripts/analyze-database.js
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, count, desc, asc } = require('drizzle-orm');
require('dotenv').config({ path: '.env.local' });

// Initialize database connection
const connectionString = process.env.DATABASE_URL;
const queryClient = postgres(connectionString, {
  idle_timeout: 30,
  max_lifetime: 60 * 60,
});

// Import schema
const { pgTable, uuid, text, timestamp, varchar, boolean, integer, jsonb, numeric } = require('drizzle-orm/pg-core');

// Define schemas for analysis
const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  name: text('name'),
  companyName: text('company_name'),
  industry: text('industry'),
  email: text('email'),
  signupTimestamp: timestamp('signup_timestamp').notNull().defaultNow(),
  onboardingStep: varchar('onboarding_step', { length: 50 }).notNull().default('pending'),
  fullName: text('full_name'),
  businessName: text('business_name'),
  brandDescription: text('brand_description'),
  emailScheduleStatus: jsonb('email_schedule_status').default('{}'),
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),
  trialStatus: varchar('trial_status', { length: 20 }).default('pending'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('none'),
  clerkCustomerId: text('clerk_customer_id'),
  clerkSubscriptionId: text('clerk_subscription_id'),
  currentPlan: varchar('current_plan', { length: 20 }).default('free'),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  searchType: varchar('search_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const scrapingJobs = pgTable('scraping_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  runId: text('run_id'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  keywords: jsonb('keywords'),
  platform: varchar('platform', { length: 50 }).notNull().default('Tiktok'),
  region: varchar('region', { length: 10 }).notNull().default('US'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  timeoutAt: timestamp('timeout_at'),
  campaignId: uuid('campaign_id'),
  targetUsername: text('target_username'),
  searchParams: jsonb('search_params'),
  qstashMessageId: text('qstash_message_id'),
  processedRuns: integer('processed_runs').notNull().default(0),
  processedResults: integer('processed_results').notNull().default(0),
  targetResults: integer('target_results').notNull().default(1000),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  cursor: integer('cursor').default(0),
  progress: numeric('progress').default('0'),
});

const systemConfigurations = pgTable('system_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: varchar('category', { length: 50 }).notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value').notNull(),
  valueType: varchar('value_type', { length: 20 }).notNull(),
  description: text('description'),
  isHotReloadable: varchar('is_hot_reloadable', { length: 5 }).notNull().default('true'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const db = drizzle(queryClient, {
  schema: { userProfiles, campaigns, scrapingJobs, systemConfigurations }
});

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSubHeader(title) {
  log(`\n📊 ${title}`, 'yellow');
  log('-'.repeat(40), 'gray');
}

async function analyzeDatabase() {
  try {
    log('🔍 Starting comprehensive database analysis...', 'cyan');
    
    // 1. Database Connection Test
    logHeader('DATABASE CONNECTION TEST');
    const testQuery = await queryClient`SELECT NOW() as current_time, version() as pg_version`;
    log(`✅ Database connected successfully`, 'green');
    log(`   🕐 Current time: ${testQuery[0].current_time}`, 'blue');
    log(`   🔢 PostgreSQL version: ${testQuery[0].pg_version.split(' ')[0]}`, 'blue');

    // 2. Table Structure Analysis
    logHeader('TABLE STRUCTURE ANALYSIS');
    
    // Get all tables
    const tables = await queryClient`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    log(`📋 Found ${tables.length} tables in public schema:`, 'green');
    tables.forEach(table => {
      log(`   • ${table.table_name}`, 'blue');
    });

    // 3. User Profiles Analysis
    logHeader('USER PROFILES ANALYSIS');
    
    // Get user profiles count
    const userCount = await db.select({ count: count() }).from(userProfiles);
    log(`👥 Total users: ${userCount[0].count}`, 'green');
    
    if (userCount[0].count > 0) {
      // Plan distribution
      logSubHeader('Plan Distribution');
      const planDistribution = await queryClient`
        SELECT 
          current_plan, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_profiles), 2) as percentage
        FROM user_profiles 
        GROUP BY current_plan 
        ORDER BY count DESC;
      `;
      
      planDistribution.forEach(plan => {
        log(`   📊 ${plan.current_plan || 'NULL'}: ${plan.count} users (${plan.percentage}%)`, 'blue');
      });

      // Trial status distribution
      logSubHeader('Trial Status Distribution');
      const trialDistribution = await queryClient`
        SELECT 
          trial_status, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_profiles), 2) as percentage
        FROM user_profiles 
        GROUP BY trial_status 
        ORDER BY count DESC;
      `;
      
      trialDistribution.forEach(trial => {
        log(`   ⏰ ${trial.trial_status || 'NULL'}: ${trial.count} users (${trial.percentage}%)`, 'blue');
      });

      // Onboarding step distribution
      logSubHeader('Onboarding Step Distribution');
      const onboardingDistribution = await queryClient`
        SELECT 
          onboarding_step, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_profiles), 2) as percentage
        FROM user_profiles 
        GROUP BY onboarding_step 
        ORDER BY count DESC;
      `;
      
      onboardingDistribution.forEach(step => {
        log(`   📝 ${step.onboarding_step || 'NULL'}: ${step.count} users (${step.percentage}%)`, 'blue');
      });

      // Subscription status distribution
      logSubHeader('Subscription Status Distribution');
      const subscriptionDistribution = await queryClient`
        SELECT 
          subscription_status, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_profiles), 2) as percentage
        FROM user_profiles 
        GROUP BY subscription_status 
        ORDER BY count DESC;
      `;
      
      subscriptionDistribution.forEach(status => {
        log(`   💳 ${status.subscription_status || 'NULL'}: ${status.count} users (${status.percentage}%)`, 'blue');
      });

      // Admin users
      logSubHeader('Admin Users');
      const adminUsers = await queryClient`
        SELECT 
          user_id, 
          full_name, 
          email, 
          current_plan,
          created_at
        FROM user_profiles 
        WHERE is_admin = true 
        ORDER BY created_at DESC;
      `;
      
      if (adminUsers.length > 0) {
        log(`👑 Found ${adminUsers.length} admin users:`, 'green');
        adminUsers.forEach(admin => {
          log(`   • ${admin.full_name || 'No name'} (${admin.email || 'No email'}) - Plan: ${admin.current_plan}`, 'blue');
        });
      } else {
        log('   ⚠️ No admin users found', 'yellow');
      }

      // Recent signups
      logSubHeader('Recent User Activity');
      const recentUsers = await queryClient`
        SELECT 
          user_id, 
          full_name, 
          email, 
          current_plan,
          trial_status,
          onboarding_step,
          created_at
        FROM user_profiles 
        ORDER BY created_at DESC 
        LIMIT 10;
      `;
      
      log(`🆕 Last 10 users:`, 'green');
      recentUsers.forEach((user, index) => {
        const timeAgo = new Date(Date.now() - new Date(user.created_at).getTime()).toISOString().substr(11, 8);
        log(`   ${index + 1}. ${user.full_name || 'No name'} - ${user.current_plan} - ${user.onboarding_step} (${timeAgo} ago)`, 'blue');
      });
    }

    // 4. Campaigns Analysis
    logHeader('CAMPAIGNS ANALYSIS');
    
    const campaignCount = await db.select({ count: count() }).from(campaigns);
    log(`📊 Total campaigns: ${campaignCount[0].count}`, 'green');
    
    if (campaignCount[0].count > 0) {
      // Campaign status distribution
      const campaignStatusDistribution = await queryClient`
        SELECT 
          status, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM campaigns), 2) as percentage
        FROM campaigns 
        GROUP BY status 
        ORDER BY count DESC;
      `;
      
      logSubHeader('Campaign Status Distribution');
      campaignStatusDistribution.forEach(status => {
        log(`   📈 ${status.status}: ${status.count} campaigns (${status.percentage}%)`, 'blue');
      });

      // Search type distribution
      const searchTypeDistribution = await queryClient`
        SELECT 
          search_type, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM campaigns), 2) as percentage
        FROM campaigns 
        GROUP BY search_type 
        ORDER BY count DESC;
      `;
      
      logSubHeader('Search Type Distribution');
      searchTypeDistribution.forEach(type => {
        log(`   🔍 ${type.search_type}: ${type.count} campaigns (${type.percentage}%)`, 'blue');
      });
    }

    // 5. Scraping Jobs Analysis
    logHeader('SCRAPING JOBS ANALYSIS');
    
    const jobCount = await db.select({ count: count() }).from(scrapingJobs);
    log(`⚙️ Total scraping jobs: ${jobCount[0].count}`, 'green');
    
    if (jobCount[0].count > 0) {
      // Job status distribution
      const jobStatusDistribution = await queryClient`
        SELECT 
          status, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM scraping_jobs), 2) as percentage
        FROM scraping_jobs 
        GROUP BY status 
        ORDER BY count DESC;
      `;
      
      logSubHeader('Job Status Distribution');
      jobStatusDistribution.forEach(status => {
        log(`   ⚡ ${status.status}: ${status.count} jobs (${status.percentage}%)`, 'blue');
      });

      // Platform distribution
      const platformDistribution = await queryClient`
        SELECT 
          platform, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM scraping_jobs), 2) as percentage
        FROM scraping_jobs 
        GROUP BY platform 
        ORDER BY count DESC;
      `;
      
      logSubHeader('Platform Distribution');
      platformDistribution.forEach(platform => {
        log(`   🌐 ${platform.platform}: ${platform.count} jobs (${platform.percentage}%)`, 'blue');
      });

      // Processing statistics
      logSubHeader('Processing Statistics');
      const processingStats = await queryClient`
        SELECT 
          AVG(processed_runs) as avg_runs,
          AVG(processed_results) as avg_results,
          MAX(processed_runs) as max_runs,
          MAX(processed_results) as max_results
        FROM scraping_jobs 
        WHERE status = 'completed';
      `;
      
      if (processingStats[0].avg_runs) {
        log(`   📊 Average API runs per job: ${Math.round(processingStats[0].avg_runs * 100) / 100}`, 'blue');
        log(`   📊 Average results per job: ${Math.round(processingStats[0].avg_results * 100) / 100}`, 'blue');
        log(`   📊 Maximum API runs: ${processingStats[0].max_runs}`, 'blue');
        log(`   📊 Maximum results: ${processingStats[0].max_results}`, 'blue');
      }
    }

    // 6. System Configurations Analysis
    logHeader('SYSTEM CONFIGURATIONS ANALYSIS');
    
    const configCount = await db.select({ count: count() }).from(systemConfigurations);
    log(`⚙️ Total system configurations: ${configCount[0].count}`, 'green');
    
    if (configCount[0].count > 0) {
      const configs = await queryClient`
        SELECT category, key, value, value_type, description
        FROM system_configurations 
        ORDER BY category, key;
      `;
      
      const configsByCategory = configs.reduce((acc, config) => {
        if (!acc[config.category]) acc[config.category] = [];
        acc[config.category].push(config);
        return acc;
      }, {});
      
      Object.keys(configsByCategory).forEach(category => {
        logSubHeader(`${category} Configuration`);
        configsByCategory[category].forEach(config => {
          log(`   🔧 ${config.key}: ${config.value} (${config.value_type})`, 'blue');
          if (config.description) {
            log(`      📝 ${config.description}`, 'gray');
          }
        });
      });
    }

    // 7. Data Integrity Checks
    logHeader('DATA INTEGRITY CHECKS');
    
    // Check for users with missing required fields
    logSubHeader('Data Quality Issues');
    
    const missingData = await queryClient`
      SELECT 
        COUNT(*) FILTER (WHERE full_name IS NULL OR full_name = '') as missing_names,
        COUNT(*) FILTER (WHERE email IS NULL OR email = '') as missing_emails,
        COUNT(*) FILTER (WHERE business_name IS NULL OR business_name = '') as missing_business_names,
        COUNT(*) FILTER (WHERE onboarding_step = 'pending') as pending_onboarding,
        COUNT(*) FILTER (WHERE trial_status = 'active' AND trial_end_date < NOW()) as expired_trials,
        COUNT(*) FILTER (WHERE current_plan IS NULL) as missing_plans
      FROM user_profiles;
    `;
    
    const issues = missingData[0];
    log(`   ⚠️ Users missing full name: ${issues.missing_names}`, issues.missing_names > 0 ? 'red' : 'green');
    log(`   ⚠️ Users missing email: ${issues.missing_emails}`, issues.missing_emails > 0 ? 'red' : 'green');
    log(`   ⚠️ Users missing business name: ${issues.missing_business_names}`, issues.missing_business_names > 0 ? 'yellow' : 'green');
    log(`   ⚠️ Users with pending onboarding: ${issues.pending_onboarding}`, issues.pending_onboarding > 0 ? 'yellow' : 'green');
    log(`   ⚠️ Expired trials not updated: ${issues.expired_trials}`, issues.expired_trials > 0 ? 'red' : 'green');
    log(`   ⚠️ Users missing plan: ${issues.missing_plans}`, issues.missing_plans > 0 ? 'red' : 'green');

    // 8. Billing Integration Analysis
    logHeader('BILLING INTEGRATION ANALYSIS');
    
    logSubHeader('Clerk Integration Status');
    const clerkIntegration = await queryClient`
      SELECT 
        COUNT(*) FILTER (WHERE clerk_customer_id IS NOT NULL) as has_clerk_customer,
        COUNT(*) FILTER (WHERE clerk_subscription_id IS NOT NULL) as has_clerk_subscription,
        COUNT(*) FILTER (WHERE stripe_customer_id IS NOT NULL) as has_stripe_customer,
        COUNT(*) FILTER (WHERE stripe_subscription_id IS NOT NULL) as has_stripe_subscription,
        COUNT(*) as total_users
      FROM user_profiles;
    `;
    
    const billing = clerkIntegration[0];
    log(`   🔗 Users with Clerk customer ID: ${billing.has_clerk_customer}/${billing.total_users}`, 'blue');
    log(`   🔗 Users with Clerk subscription ID: ${billing.has_clerk_subscription}/${billing.total_users}`, 'blue');
    log(`   🔗 Users with Stripe customer ID: ${billing.has_stripe_customer}/${billing.total_users}`, 'blue');
    log(`   🔗 Users with Stripe subscription ID: ${billing.has_stripe_subscription}/${billing.total_users}`, 'blue');

    // 9. Current vs Required Plan Names
    logHeader('PLAN NAME MISMATCH ANALYSIS');
    
    logSubHeader('Current Plans in Database');
    const currentPlans = await queryClient`
      SELECT DISTINCT current_plan 
      FROM user_profiles 
      WHERE current_plan IS NOT NULL
      ORDER BY current_plan;
    `;
    
    currentPlans.forEach(plan => {
      log(`   📊 ${plan.current_plan}`, 'blue');
    });
    
    logSubHeader('Required Plans for Clerk Integration');
    const requiredPlans = [
      'Free (trial)',
      'Glow Up ($99/month)',
      'Viral Surge ($249/month)', 
      'Fame Flex ($499/month)',
      'Premium ($10/month) - UNWANTED'
    ];
    
    requiredPlans.forEach(plan => {
      log(`   🎯 ${plan}`, 'cyan');
    });

    // 10. Recommendations
    logHeader('RECOMMENDATIONS');
    
    log('📋 Based on the analysis, here are the key recommendations:', 'green');
    
    log('\n1. 🔄 UPDATE DATABASE SCHEMA:', 'yellow');
    log('   • Expand current_plan field to varchar(50) for longer plan names', 'white');
    log('   • Add payment method fields (card info, payment_method_id)', 'white');
    log('   • Add plan feature tracking fields', 'white');
    
    log('\n2. 🏗️ PLAN NAME MIGRATION:', 'yellow');
    log('   • Map current plan names to Clerk plan names', 'white');
    log('   • Handle the unwanted Premium plan issue', 'white');
    log('   • Create migration script for existing users', 'white');
    
    log('\n3. 💳 BILLING INTEGRATION:', 'yellow');
    log('   • Update billing hooks to use actual Clerk plan names', 'white');
    log('   • Implement payment method collection in onboarding', 'white');
    log('   • Add feature restrictions per plan tier', 'white');
    
    log('\n4. 🔧 DATA CLEANUP:', 'yellow');
    if (issues.missing_names > 0) log('   • Fix users with missing names', 'white');
    if (issues.expired_trials > 0) log('   • Update expired trial statuses', 'white');
    if (issues.missing_plans > 0) log('   • Assign plans to users without one', 'white');
    
    log('\n5. 📊 MONITORING SETUP:', 'yellow');
    log('   • Track plan conversion rates', 'white');
    log('   • Monitor trial completion rates', 'white');
    log('   • Set up billing webhook logging', 'white');

    // Summary
    logHeader('ANALYSIS SUMMARY');
    log(`✅ Database connection: Working`, 'green');
    log(`📊 Total users: ${userCount[0].count}`, 'green');
    log(`📈 Total campaigns: ${campaignCount[0].count}`, 'green');
    log(`⚙️ Total scraping jobs: ${jobCount[0].count}`, 'green');
    log(`🔧 System configurations: ${configCount[0].count}`, 'green');
    log(`⚠️ Plan name mismatch: ${currentPlans.length > 0 ? 'REQUIRES MIGRATION' : 'No users yet'}`, 'yellow');
    log(`💳 Billing integration: ${billing.has_clerk_customer > 0 ? 'PARTIALLY ACTIVE' : 'NOT ACTIVE'}`, 'yellow');
    
    log('\n🎯 Next steps: Update billing system to match your Clerk plans', 'cyan');
    log('📄 Full analysis complete. Review recommendations above.', 'green');
    
  } catch (error) {
    log(`\n❌ Error analyzing database: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await queryClient.end();
  }
}

// Run the analysis
analyzeDatabase().then(() => {
  process.exit(0);
}).catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});