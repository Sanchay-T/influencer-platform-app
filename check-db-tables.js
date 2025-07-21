#!/usr/bin/env node

/**
 * Check Database Tables and Find the Correct Structure
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function checkDatabaseTables() {
  console.log('🔍 CHECKING DATABASE STRUCTURE');
  console.log('━'.repeat(50));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // List all tables
    console.log('\n📊 LISTING ALL TABLES:');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.log('Found tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });
    
    // Check if there's a user-related table
    const userTableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name ILIKE '%user%' OR table_name ILIKE '%profile%')
      ORDER BY table_name;
    `;
    
    const userTablesResult = await client.query(userTableQuery);
    if (userTablesResult.rows.length > 0) {
      console.log('\n👤 USER-RELATED TABLES:');
      userTablesResult.rows.forEach(row => {
        console.log(`   • ${row.table_name}`);
      });
      
      // Check the structure of the first user table
      const userTable = userTablesResult.rows[0].table_name;
      console.log(`\n🔍 CHECKING STRUCTURE OF "${userTable}":`);
      
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      
      const columnsResult = await client.query(columnsQuery, [userTable]);
      columnsResult.rows.forEach(row => {
        console.log(`   • ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      // Look for Stripe-related data
      console.log(`\n🔍 SEARCHING FOR STRIPE DATA IN "${userTable}":`);
      const stripeQuery = `
        SELECT * FROM "${userTable}" 
        WHERE "stripeSubscriptionId" IS NOT NULL 
           OR "stripeCustomerId" IS NOT NULL
        LIMIT 5;
      `;
      
      try {
        const stripeResult = await client.query(stripeQuery);
        if (stripeResult.rows.length > 0) {
          console.log(`Found ${stripeResult.rows.length} users with Stripe data:`);
          stripeResult.rows.forEach(row => {
            console.log(`   User: ${row.userId || row.id}`);
            console.log(`   Subscription: ${row.stripeSubscriptionId}`);
            console.log(`   Customer: ${row.stripeCustomerId}`);
            console.log('   ---');
          });
        } else {
          console.log('No users with Stripe data found');
        }
      } catch (err) {
        console.log('Could not query for Stripe data - columns might have different names');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabaseTables().catch(console.error);