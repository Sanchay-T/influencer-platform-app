#!/usr/bin/env node

/**
 * Initialize Logging Configuration Script
 * 
 * This script populates the database with default logging configuration
 * values to prevent startup errors when the new logging system is deployed.
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const { eq, and } = require('drizzle-orm');
const postgres = require('postgres');

// Database configuration
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create database connection
const queryClient = postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Import schema
const { systemConfigurations } = require('../lib/db/schema');
const db = drizzle(queryClient, { schema: { systemConfigurations } });

// Logging configuration defaults
const LOGGING_CONFIGS = [
  // Log levels
  { category: 'logging', key: 'min_level_development', value: 'DEBUG', valueType: 'string', description: 'Minimum log level in development environment' },
  { category: 'logging', key: 'min_level', value: 'INFO', valueType: 'string', description: 'Minimum log level in production environment' },
  
  // Sentry configuration
  { category: 'logging', key: 'enable_sentry_development', value: 'true', valueType: 'boolean', description: 'Enable Sentry in development environment' },
  { category: 'logging', key: 'enable_sentry', value: 'true', valueType: 'boolean', description: 'Enable Sentry in production environment' },
  
  // Sentry sampling rates
  { category: 'logging', key: 'sentry_traces_sample_rate_development', value: '1.0', valueType: 'number', description: 'Sentry traces sample rate in development (100%)' },
  { category: 'logging', key: 'sentry_traces_sample_rate', value: '0.1', valueType: 'number', description: 'Sentry traces sample rate in production (10%)' },
  
  // Sentry session sampling
  { category: 'logging', key: 'sentry_session_sample_rate_development', value: '1.0', valueType: 'number', description: 'Sentry session sample rate in development (100%)' },
  { category: 'logging', key: 'sentry_session_sample_rate', value: '0.1', valueType: 'number', description: 'Sentry session sample rate in production (10%)' },
  
  // Performance tracking
  { category: 'logging', key: 'enable_performance_tracking_development', value: 'true', valueType: 'boolean', description: 'Enable performance tracking in development' },
  { category: 'logging', key: 'enable_performance_tracking', value: 'true', valueType: 'boolean', description: 'Enable performance tracking in production' },
  
  // Performance thresholds
  { category: 'logging', key: 'slow_operation_threshold_development', value: '1000', valueType: 'number', description: 'Slow operation threshold in development (ms)' },
  { category: 'logging', key: 'slow_operation_threshold', value: '5000', valueType: 'number', description: 'Slow operation threshold in production (ms)' },
  
  // Rate limiting
  { category: 'logging', key: 'enable_rate_limiting_development', value: 'false', valueType: 'boolean', description: 'Enable rate limiting in development' },
  { category: 'logging', key: 'enable_rate_limiting', value: 'true', valueType: 'boolean', description: 'Enable rate limiting in production' },
];

async function initializeLoggingConfig() {
  console.log('🚀 Initializing logging configuration in database...');
  console.log(`📦 Total configurations to initialize: ${LOGGING_CONFIGS.length}`);
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  try {
    for (const config of LOGGING_CONFIGS) {
      try {
        // Check if configuration already exists
        const existing = await db.query.systemConfigurations.findFirst({
          where: and(
            eq(systemConfigurations.category, config.category),
            eq(systemConfigurations.key, config.key)
          )
        });
        
        if (existing) {
          console.log(`⚠️  Configuration already exists: ${config.category}.${config.key} = ${existing.value}`);
          skipped++;
          continue;
        }
        
        // Insert new configuration
        await db.insert(systemConfigurations).values({
          category: config.category,
          key: config.key,
          value: config.value,
          valueType: config.valueType,
          description: config.description || `${config.category}.${config.key} configuration`,
          isHotReloadable: 'true'
        });
        
        console.log(`✅ Created: ${config.category}.${config.key} = ${config.value} (${config.valueType})`);
        created++;
        
      } catch (error) {
        console.error(`❌ Error creating configuration ${config.category}.${config.key}:`, error.message);
      }
    }
    
    console.log('\n📊 Initialization Summary:');
    console.log(`  ✅ Created: ${created}`);
    console.log(`  🔄 Updated: ${updated}`);
    console.log(`  ⚠️  Skipped (already exists): ${skipped}`);
    console.log(`  📦 Total processed: ${created + updated + skipped}`);
    
    if (created > 0) {
      console.log('\n🎉 Logging configuration initialized successfully!');
      console.log('💡 The logging system should now start without configuration errors.');
    } else {
      console.log('\n✅ All logging configurations already exist in the database.');
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize logging configuration:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

async function validateDatabaseConnection() {
  try {
    console.log('🔍 Validating database connection...');
    
    // Test connection
    const result = await queryClient`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    
    // Check if systemConfigurations table exists
    const tableCheck = await queryClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'system_configurations' 
      AND table_schema = 'public'
    `;
    
    if (tableCheck.length === 0) {
      console.error('❌ systemConfigurations table not found. Please run database migrations first:');
      console.error('   npm run db:push');
      process.exit(1);
    }
    
    console.log('✅ systemConfigurations table exists');
    
  } catch (error) {
    console.error('❌ Database validation failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check DATABASE_URL environment variable');
    console.error('2. Ensure database is running and accessible');
    console.error('3. Run database migrations: npm run db:push');
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🎯 Logging Configuration Initializer');
  console.log('='  .repeat(50));
  
  await validateDatabaseConnection();
  await initializeLoggingConfig();
  
  console.log('\n🚀 Ready to test the logging system!');
  console.log('Next steps:');
  console.log('1. npm start                  # Start development server');
  console.log('2. npm run test:logging       # Run logging system tests');
  console.log('3. Check browser console      # Should see clean, structured logs');
}

// Handle command line execution
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { initializeLoggingConfig, LOGGING_CONFIGS };