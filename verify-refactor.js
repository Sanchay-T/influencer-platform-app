/**
 * Simple verification script for database refactoring
 */

const postgres = require('postgres');

// Use the same connection logic from the app
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString, {
  idle_timeout: 30,
  max_lifetime: 60 * 60,
  max: 5,
  connect_timeout: 10,
});

async function verifyRefactor() {
  console.log('🔍 Verifying Database Refactoring Implementation...\n');
  
  try {
    // Check 1: Verify new table structure exists
    console.log('📋 Checking new table structure...');
    
    const newTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('users', 'user_subscriptions', 'user_billing', 'user_usage', 'user_system_data')
      ORDER BY table_name
    `;
    
    console.log('✅ Found new tables:');
    newTables.forEach(table => console.log(`   - ${table.table_name}`));
    
    if (newTables.length === 5) {
      console.log('✅ All 5 normalized tables are present\n');
    } else {
      console.log(`⚠️ Expected 5 tables, found ${newTables.length}. Migration may not have run yet.\n`);
    }
    
    // Check 2: Verify old user_profiles table still exists (for backward compatibility)
    console.log('📋 Checking backward compatibility...');
    
    const oldTable = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_profiles'
    `;
    
    if (oldTable.length > 0) {
      console.log('✅ user_profiles table still exists for backward compatibility\n');
    } else {
      console.log('⚠️ user_profiles table not found\n');
    }
    
    // Check 3: Verify schema consistency
    console.log('🏗️ Verifying schema consistency...');
    
    // Check that users table has the expected columns
    const userColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const expectedUserColumns = ['id', 'user_id', 'email', 'full_name', 'onboarding_step'];
    const foundColumns = userColumns.map(col => col.column_name);
    const hasRequiredColumns = expectedUserColumns.every(col => foundColumns.includes(col));
    
    if (hasRequiredColumns) {
      console.log('✅ Users table has all required columns');
      console.log(`   Found columns: ${foundColumns.join(', ')}\n`);
    } else {
      console.log('⚠️ Users table missing some required columns\n');
    }
    
    // Check 4: Test data migration status
    console.log('📊 Checking data migration status...');
    
    const userCount = await sql`SELECT COUNT(*) as count FROM user_profiles WHERE user_id IS NOT NULL`;
    console.log(`📈 Current user_profiles records: ${userCount[0].count}`);
    
    if (newTables.length === 5) {
      const newUserCount = await sql`SELECT COUNT(*) as count FROM users WHERE user_id IS NOT NULL`;
      console.log(`📈 New users table records: ${newUserCount[0].count}`);
      
      if (userCount[0].count > 0 && newUserCount[0].count === 0) {
        console.log('⚠️ Data exists in user_profiles but not in users table - migration needs to run');
      } else if (userCount[0].count === newUserCount[0].count) {
        console.log('✅ Data migration appears successful');
      }
    }
    
    console.log('\n🎉 Verification completed!');
    console.log('📝 Summary:');
    console.log(`   - New tables: ${newTables.length}/5`);
    console.log(`   - Old table preserved: ${oldTable.length > 0 ? 'Yes' : 'No'}`);
    console.log(`   - Schema integrity: ${hasRequiredColumns ? 'Good' : 'Needs attention'}`);
    
    if (newTables.length === 5) {
      console.log('\n🚀 Ready to run migration with: npm run dev');
    } else {
      console.log('\n📋 Next step: Apply the migration to create normalized tables');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('🔍 Details:', error.stack);
  }
  
  await sql.end();
  process.exit(0);
}

// Run verification
verifyRefactor().catch(console.error);