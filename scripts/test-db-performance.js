const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function testDBPerformance() {
  console.log('\n🔬 DATABASE PERFORMANCE TEST\n');
  console.log('='.repeat(50));

  const sql = postgres(process.env.DATABASE_URL, {
    max: 1, // Single connection for testing
    idle_timeout: 0,
    max_lifetime: 0,
  });

  try {
    // Test 1: Simple ping
    console.log('🏓 Test 1: Database ping...');
    const pingStart = Date.now();
    await sql`SELECT 1 as ping`;
    const pingTime = Date.now() - pingStart;
    console.log(`   Ping: ${pingTime}ms`);

    // Test 2: Count query
    console.log('\n📊 Test 2: Count query...');
    const countStart = Date.now();
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM user_profiles`;
    const countTime = Date.now() - countStart;
    console.log(`   Count query: ${countTime}ms (${count} total users)`);

    // Test 3: Simple select
    console.log('\n🔍 Test 3: Simple SELECT...');
    const selectStart = Date.now();
    await sql`SELECT user_id, full_name FROM user_profiles LIMIT 5`;
    const selectTime = Date.now() - selectStart;
    console.log(`   Simple SELECT: ${selectTime}ms`);

    // Test 4: The actual slow query
    console.log('\n🐌 Test 4: Actual search query...');
    const searchStart = Date.now();
    await sql`
      SELECT user_id, full_name, business_name 
      FROM user_profiles 
      WHERE full_name ILIKE ${'san%'} OR full_name ILIKE ${'%san%'}
      LIMIT 5
    `;
    const searchTime = Date.now() - searchStart;
    console.log(`   Search query: ${searchTime}ms`);

    // Test 5: Index usage
    console.log('\n📋 Test 5: Check indexes...');
    const indexStart = Date.now();
    const indexes = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'user_profiles' 
      AND indexname LIKE '%search%'
    `;
    const indexTime = Date.now() - indexStart;
    console.log(`   Index check: ${indexTime}ms`);
    console.log(`   Found ${indexes.length} search indexes`);

    // Test 6: Database location/latency
    console.log('\n🌍 Test 6: Database info...');
    const infoStart = Date.now();
    const [dbInfo] = await sql`
      SELECT 
        version() as version,
        current_database() as database,
        inet_server_addr() as server_ip
    `;
    const infoTime = Date.now() - infoStart;
    console.log(`   Info query: ${infoTime}ms`);
    console.log(`   Database: ${dbInfo.database}`);
    console.log(`   Server IP: ${dbInfo.server_ip || 'localhost'}`);

    console.log('\n' + '='.repeat(50));
    console.log('📊 PERFORMANCE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`🏓 Ping: ${pingTime}ms`);
    console.log(`📊 Count: ${countTime}ms`);
    console.log(`🔍 Select: ${selectTime}ms`);
    console.log(`🐌 Search: ${searchTime}ms`);
    console.log(`📋 Index: ${indexTime}ms`);

    if (pingTime > 200) console.log('⚠️  High latency detected - database may be geographically distant');
    if (searchTime > 500) console.log('⚠️  Search query is unusually slow - possible index issue');
    if (countTime > 100) console.log('⚠️  Basic queries are slow - database server issue');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

testDBPerformance();