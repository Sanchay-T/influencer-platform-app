#!/usr/bin/env node

const { config } = require('dotenv');
const path = require('path');

// Load development environment
config({ path: path.resolve(process.cwd(), '.env.development') });

console.log('🔧 Testing local database connection...');
console.log(`📍 Database URL: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);

// Test database connection
async function testConnection() {
  try {
    // Import and initialize database connection
    const { db } = require('../lib/db/index.ts');
    const { userProfiles } = require('../lib/db/schema.ts');
    
    console.log('🔌 Testing database connection...');
    
    // Simple query to test connection
    const result = await db.select().from(userProfiles).limit(1);
    
    console.log('✅ Database connection successful!');
    console.log(`📊 Found ${result.length} user profiles in database`);
    
    // Test all tables exist
    console.log('🔍 Testing table existence...');
    const tables = [
      'campaigns',
      'scraping_jobs', 
      'scraping_results',
      'user_profiles',
      'system_configurations',
      'events',
      'background_jobs'
    ];
    
    for (const table of tables) {
      try {
        await db.execute(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`✅ Table '${table}' exists and is accessible`);
      } catch (error) {
        console.log(`❌ Table '${table}' error:`, error.message);
      }
    }
    
    console.log('');
    console.log('🎉 Local database test completed successfully!');
    console.log('💡 You can now run: npm run dev:local');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   1. Make sure PostgreSQL is running: docker-compose ps');
    console.log('   2. Check logs: docker-compose logs postgres');
    console.log('   3. Reset database: npm run db:local:reset');
    
    process.exit(1);
  }
}

// Set NODE_ENV for proper environment loading
process.env.NODE_ENV = 'development';

testConnection();