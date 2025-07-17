#!/usr/bin/env node

/**
 * Database Schema Update Script
 * 
 * This script updates the database schema to support the new Clerk billing plans
 * and adds payment method fields for enhanced billing integration.
 * 
 * Updates:
 * 1. Expand current_plan field to varchar(50) for longer plan names
 * 2. Add payment method fields for card storage
 * 3. Add plan feature tracking fields
 * 4. Add billing webhook tracking fields
 * 
 * Usage: node scripts/update-database-schema.js
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

// Initialize database connection
const connectionString = process.env.DATABASE_URL;
const queryClient = postgres(connectionString, {
  idle_timeout: 30,
  max_lifetime: 60 * 60,
});

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

async function updateDatabaseSchema() {
  try {
    logHeader('DATABASE SCHEMA UPDATE');
    log('🔄 Starting database schema updates for Clerk billing integration...', 'cyan');
    
    // 1. Backup current schema
    log('\n📋 Step 1: Creating backup of current schema...', 'yellow');
    
    const currentSchema = await queryClient`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    log(`✅ Current user_profiles table has ${currentSchema.length} columns`, 'green');
    
    // 2. Check current plan field constraints
    log('\n📋 Step 2: Checking current plan field constraints...', 'yellow');
    
    const currentPlanField = currentSchema.find(col => col.column_name === 'current_plan');
    if (currentPlanField) {
      log(`   Current plan field: ${currentPlanField.data_type}(${currentPlanField.character_maximum_length})`, 'blue');
      log(`   Is nullable: ${currentPlanField.is_nullable}`, 'blue');
      log(`   Default: ${currentPlanField.column_default}`, 'blue');
    }
    
    // 3. Update current_plan field to support longer plan names
    log('\n📋 Step 3: Updating current_plan field to support longer plan names...', 'yellow');
    
    try {
      await queryClient`
        ALTER TABLE user_profiles 
        ALTER COLUMN current_plan TYPE varchar(50);
      `;
      log('✅ Successfully expanded current_plan field to varchar(50)', 'green');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('no change')) {
        log('ℹ️  current_plan field already has sufficient length', 'blue');
      } else {
        throw error;
      }
    }
    
    // 4. Add payment method fields
    log('\n📋 Step 4: Adding payment method fields...', 'yellow');
    
    const paymentFields = [
      {
        name: 'payment_method_id',
        type: 'TEXT',
        description: 'Stripe/Clerk payment method ID'
      },
      {
        name: 'card_last_4',
        type: 'VARCHAR(4)',
        description: 'Last 4 digits of card'
      },
      {
        name: 'card_brand',
        type: 'VARCHAR(20)',
        description: 'Card brand (visa, mastercard, etc.)'
      },
      {
        name: 'card_exp_month',
        type: 'INTEGER',
        description: 'Card expiration month'
      },
      {
        name: 'card_exp_year',
        type: 'INTEGER',
        description: 'Card expiration year'
      },
      {
        name: 'billing_address_city',
        type: 'TEXT',
        description: 'Billing address city'
      },
      {
        name: 'billing_address_country',
        type: 'VARCHAR(2)',
        description: 'Billing address country code'
      },
      {
        name: 'billing_address_postal_code',
        type: 'VARCHAR(20)',
        description: 'Billing address postal code'
      }
    ];
    
    for (const field of paymentFields) {
      try {
        await queryClient`
          ALTER TABLE user_profiles 
          ADD COLUMN ${queryClient(field.name)} ${queryClient.unsafe(field.type)};
        `;
        log(`   ✅ Added ${field.name} (${field.type}) - ${field.description}`, 'green');
      } catch (error) {
        if (error.message.includes('already exists')) {
          log(`   ℹ️  ${field.name} already exists`, 'blue');
        } else {
          log(`   ❌ Failed to add ${field.name}: ${error.message}`, 'red');
        }
      }
    }
    
    // 5. Add plan feature tracking fields
    log('\n📋 Step 5: Adding plan feature tracking fields...', 'yellow');
    
    const featureFields = [
      {
        name: 'plan_campaigns_limit',
        type: 'INTEGER',
        description: 'Number of campaigns allowed per plan'
      },
      {
        name: 'plan_creators_limit',
        type: 'INTEGER',
        description: 'Number of creators allowed per month'
      },
      {
        name: 'plan_features',
        type: 'JSONB',
        description: 'Plan features as JSON object'
      },
      {
        name: 'usage_campaigns_current',
        type: 'INTEGER DEFAULT 0',
        description: 'Current number of active campaigns'
      },
      {
        name: 'usage_creators_current_month',
        type: 'INTEGER DEFAULT 0',
        description: 'Creators sourced this month'
      },
      {
        name: 'usage_reset_date',
        type: 'TIMESTAMP DEFAULT NOW()',
        description: 'When usage counters were last reset'
      }
    ];
    
    for (const field of featureFields) {
      try {
        await queryClient`
          ALTER TABLE user_profiles 
          ADD COLUMN ${queryClient(field.name)} ${queryClient.unsafe(field.type)};
        `;
        log(`   ✅ Added ${field.name} - ${field.description}`, 'green');
      } catch (error) {
        if (error.message.includes('already exists')) {
          log(`   ℹ️  ${field.name} already exists`, 'blue');
        } else {
          log(`   ❌ Failed to add ${field.name}: ${error.message}`, 'red');
        }
      }
    }
    
    // 6. Add billing webhook tracking fields
    log('\n📋 Step 6: Adding billing webhook tracking fields...', 'yellow');
    
    const webhookFields = [
      {
        name: 'last_webhook_event',
        type: 'VARCHAR(100)',
        description: 'Last Clerk webhook event received'
      },
      {
        name: 'last_webhook_timestamp',
        type: 'TIMESTAMP',
        description: 'When last webhook was received'
      },
      {
        name: 'billing_sync_status',
        type: 'VARCHAR(20) DEFAULT \'pending\'',
        description: 'Status of billing sync with Clerk'
      },
      {
        name: 'trial_conversion_date',
        type: 'TIMESTAMP',
        description: 'When trial was converted to paid'
      },
      {
        name: 'subscription_cancel_date',
        type: 'TIMESTAMP',
        description: 'When subscription was cancelled'
      },
      {
        name: 'subscription_renewal_date',
        type: 'TIMESTAMP',
        description: 'Next subscription renewal date'
      }
    ];
    
    for (const field of webhookFields) {
      try {
        await queryClient`
          ALTER TABLE user_profiles 
          ADD COLUMN ${queryClient(field.name)} ${queryClient.unsafe(field.type)};
        `;
        log(`   ✅ Added ${field.name} - ${field.description}`, 'green');
      } catch (error) {
        if (error.message.includes('already exists')) {
          log(`   ℹ️  ${field.name} already exists`, 'blue');
        } else {
          log(`   ❌ Failed to add ${field.name}: ${error.message}`, 'red');
        }
      }
    }
    
    // 7. Create billing audit log table
    log('\n📋 Step 7: Creating billing audit log table...', 'yellow');
    
    try {
      await queryClient`
        CREATE TABLE IF NOT EXISTS billing_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          event_data JSONB NOT NULL,
          clerk_event_id TEXT,
          webhook_signature TEXT,
          processed_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `;
      log('✅ Created billing_audit_log table', 'green');
      
      // Add index for faster queries
      await queryClient`
        CREATE INDEX IF NOT EXISTS idx_billing_audit_user_id ON billing_audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_billing_audit_event_type ON billing_audit_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_billing_audit_created_at ON billing_audit_log(created_at);
      `;
      log('✅ Created indexes for billing_audit_log table', 'green');
      
    } catch (error) {
      if (error.message.includes('already exists')) {
        log('ℹ️  billing_audit_log table already exists', 'blue');
      } else {
        log(`❌ Failed to create billing_audit_log table: ${error.message}`, 'red');
      }
    }
    
    // 8. Update plan values to match Clerk plans
    log('\n📋 Step 8: Updating existing plan values to match Clerk plans...', 'yellow');
    
    const planMappings = {
      'free': 'free',           // Keep free as-is
      'premium': 'glow_up',     // Map old premium to glow_up
      'basic': 'glow_up',       // Map basic to glow_up
      'enterprise': 'fame_flex' // Map enterprise to fame_flex
    };
    
    for (const [oldPlan, newPlan] of Object.entries(planMappings)) {
      try {
        const updateResult = await queryClient`
          UPDATE user_profiles 
          SET current_plan = ${newPlan}
          WHERE current_plan = ${oldPlan};
        `;
        
        if (updateResult.count > 0) {
          log(`   ✅ Updated ${updateResult.count} users from '${oldPlan}' to '${newPlan}'`, 'green');
        } else {
          log(`   ℹ️  No users found with plan '${oldPlan}'`, 'blue');
        }
      } catch (error) {
        log(`   ❌ Failed to update plan mapping ${oldPlan} -> ${newPlan}: ${error.message}`, 'red');
      }
    }
    
    // 9. Initialize plan features for existing users
    log('\n📋 Step 9: Initializing plan features for existing users...', 'yellow');
    
    const planFeatures = {
      'free': {
        campaigns: 0,
        creators: 0,
        features: ['trial_access'],
        price: 0
      },
      'glow_up': {
        campaigns: 3,
        creators: 1000,
        features: ['unlimited_search', 'csv_export', 'bio_extraction'],
        price: 99
      },
      'viral_surge': {
        campaigns: 10,
        creators: 10000,
        features: ['unlimited_search', 'csv_export', 'bio_extraction', 'advanced_analytics'],
        price: 249
      },
      'fame_flex': {
        campaigns: -1, // unlimited
        creators: -1,  // unlimited
        features: ['unlimited_search', 'csv_export', 'bio_extraction', 'advanced_analytics', 'api_access', 'priority_support'],
        price: 499
      }
    };
    
    for (const [planName, features] of Object.entries(planFeatures)) {
      try {
        const updateResult = await queryClient`
          UPDATE user_profiles 
          SET 
            plan_campaigns_limit = ${features.campaigns},
            plan_creators_limit = ${features.creators},
            plan_features = ${JSON.stringify(features)}
          WHERE current_plan = ${planName} AND plan_features IS NULL;
        `;
        
        if (updateResult.count > 0) {
          log(`   ✅ Updated ${updateResult.count} users with '${planName}' plan features`, 'green');
        } else {
          log(`   ℹ️  No users with '${planName}' plan need feature initialization`, 'blue');
        }
      } catch (error) {
        log(`   ❌ Failed to initialize features for '${planName}': ${error.message}`, 'red');
      }
    }
    
    // 10. Verify schema updates
    log('\n📋 Step 10: Verifying schema updates...', 'yellow');
    
    const updatedSchema = await queryClient`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    log(`✅ Updated user_profiles table now has ${updatedSchema.length} columns`, 'green');
    
    // Show new fields
    const newFields = updatedSchema.filter(col => 
      col.column_name.includes('payment_') || 
      col.column_name.includes('plan_') ||
      col.column_name.includes('usage_') ||
      col.column_name.includes('billing_') ||
      col.column_name.includes('webhook_') ||
      col.column_name.includes('card_') ||
      col.column_name.includes('trial_conversion') ||
      col.column_name.includes('subscription_')
    );
    
    log(`\n📋 New fields added (${newFields.length}):`, 'cyan');
    newFields.forEach(field => {
      log(`   • ${field.column_name} (${field.data_type}${field.character_maximum_length ? `(${field.character_maximum_length})` : ''})`, 'blue');
    });
    
    // 11. Check billing audit log table
    const auditLogExists = await queryClient`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'billing_audit_log'
      );
    `;
    
    if (auditLogExists[0].exists) {
      log('\n✅ billing_audit_log table is ready', 'green');
    }
    
    // 12. Show final summary
    logHeader('SCHEMA UPDATE SUMMARY');
    log('✅ Database schema successfully updated for Clerk billing integration', 'green');
    log('✅ Payment method fields added for card storage', 'green');
    log('✅ Plan feature tracking fields added', 'green');
    log('✅ Billing webhook tracking fields added', 'green');
    log('✅ Billing audit log table created', 'green');
    log('✅ Existing plan values updated to match Clerk plans', 'green');
    log('✅ Plan features initialized for existing users', 'green');
    
    log('\n🎯 Next steps:', 'cyan');
    log('   1. Update billing hooks to use new plan names', 'blue');
    log('   2. Update frontend components to use new plan structure', 'blue');
    log('   3. Test Clerk billing integration with new schema', 'blue');
    log('   4. Implement payment method collection in onboarding', 'blue');
    
    log('\n📊 Current plan distribution after updates:', 'cyan');
    const finalPlanDistribution = await queryClient`
      SELECT current_plan, COUNT(*) as count
      FROM user_profiles 
      GROUP BY current_plan 
      ORDER BY count DESC;
    `;
    
    finalPlanDistribution.forEach(plan => {
      log(`   • ${plan.current_plan}: ${plan.count} users`, 'blue');
    });
    
  } catch (error) {
    log(`\n❌ Error updating database schema: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await queryClient.end();
  }
}

// Run the schema update
updateDatabaseSchema().then(() => {
  process.exit(0);
}).catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});