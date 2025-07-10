const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Read the latest migration
  const migrationPath = path.join(__dirname, 'supabase/migrations/0009_trial_system.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by statement breakpoints and clean up
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  console.log(`Found ${statements.length} SQL statements to execute`);

  // Connect to database
  const sql = postgres(process.env.DATABASE_URL);

  try {
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}:`, statement.substring(0, 50) + '...');
      
      await sql.unsafe(statement);
      console.log(`✅ Statement ${i + 1} executed successfully`);
    }
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

runMigration().catch(console.error);