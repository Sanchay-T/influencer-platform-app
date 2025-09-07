/**
 * 🔍 MCP-BASED DATABASE VERIFICATION TESTS
 * Uses actual database connections via MCP to verify our refactoring
 */

// This script uses console commands that interface with Claude's MCP tools
// Run this after the migration to verify everything works

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class MCPDatabaseVerifier {
  constructor() {
    this.tests = [
      'Pre-Migration Verification',
      'Post-Migration Table Structure',
      'Data Integrity Verification', 
      'Performance Index Verification',
      'Constraint Verification',
      'Migration Flag Verification',
      'Rollback Safety Check'
    ];
    
    this.mcpQueries = {
      // Pre-migration checks
      checkCurrentTables: `
        SELECT table_name, 
               (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
          AND table_name LIKE '%user%'
        ORDER BY table_name;
      `,
      
      // Post-migration verification
      checkNormalizedTables: `
        SELECT table_name
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('users', 'user_subscriptions', 'user_billing', 'user_usage', 'user_system_data')
        ORDER BY table_name;
      `,
      
      // Column verification
      verifyUsersTableStructure: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `,
      
      // Foreign key verification
      verifyForeignKeys: `
        SELECT 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name IN ('user_subscriptions', 'user_billing', 'user_usage', 'user_system_data');
      `,
      
      // Index verification
      verifyIndexes: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND (tablename LIKE 'user%' OR indexname LIKE '%user%')
        ORDER BY tablename, indexname;
      `,
      
      // Data consistency check
      checkDataConsistency: `
        SELECT 
          'user_profiles' as table_name,
          COUNT(*) as record_count
        FROM user_profiles
        UNION ALL
        SELECT 
          'users' as table_name,
          COUNT(*) as record_count
        FROM users;
      `,
      
      // Migration flag check
      checkMigrationFlag: `
        SELECT category, key, value, description
        FROM system_configurations 
        WHERE category = 'database' 
          AND key = 'user_tables_normalized';
      `
    };
  }

  generateMCPInstructions() {
    console.log(`${colors.blue}${colors.bold}🔍 MCP DATABASE VERIFICATION INSTRUCTIONS${colors.reset}`);
    console.log('═'.repeat(70));
    console.log('Copy and paste these commands into Claude Code to run MCP verification:\\n');

    console.log(`${colors.yellow}${colors.bold}STEP 1: Pre-Migration State Check${colors.reset}`);
    console.log('───────────────────────────────────────────────────────');
    console.log('Run this MCP command:');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(this.mcpQueries.checkCurrentTables);
    console.log('```\\n');

    console.log(`${colors.yellow}${colors.bold}STEP 2: Verify Normalized Tables Created${colors.reset}`);
    console.log('───────────────────────────────────────────────────────');
    console.log('After running migration, execute:');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(this.mcpQueries.checkNormalizedTables);
    console.log('```');
    console.log('Expected result: 5 tables (users, user_subscriptions, user_billing, user_usage, user_system_data)\\n');

    console.log(`${colors.yellow}${colors.bold}STEP 3: Verify Users Table Structure${colors.reset}`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(this.mcpQueries.verifyUsersTableStructure);
    console.log('```');
    console.log('Expected: id, user_id, email, full_name, business_name, etc.\\n');

    console.log(`${colors.yellow}${colors.bold}STEP 4: Verify Foreign Key Relationships${colors.reset}`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(this.mcpQueries.verifyForeignKeys);
    console.log('```');
    console.log('Expected: All child tables should reference users.id\\n');

    console.log(`${colors.yellow}${colors.bold}STEP 5: Verify Performance Indexes${colors.reset}`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(this.mcpQueries.verifyIndexes);
    console.log('```');
    console.log('Expected: Indexes on user_id, stripe_customer_id, email, etc.\\n');

    console.log(`${colors.yellow}${colors.bold}STEP 6: Check Data Migration Integrity${colors.reset}`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(this.mcpQueries.checkDataConsistency);
    console.log('```');
    console.log('Expected: user_profiles and users should have same record count\\n');

    console.log(`${colors.yellow}${colors.bold}STEP 7: Verify Migration Completion Flag${colors.reset}`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(this.mcpQueries.checkMigrationFlag);
    console.log('```');
    console.log('Expected: value = "true" indicating successful migration\\n');

    console.log(`${colors.green}${colors.bold}🎯 SUCCESS CRITERIA${colors.reset}`);
    console.log('═'.repeat(50));
    console.log('✅ All 5 normalized tables exist');
    console.log('✅ Users table has correct column structure'); 
    console.log('✅ Foreign key relationships are intact');
    console.log('✅ Performance indexes are created');
    console.log('✅ Data migration completed without loss');
    console.log('✅ Migration flag shows "true"');
    console.log('✅ No constraint violations or errors\\n');

    console.log(`${colors.blue}${colors.bold}📋 TESTING CHECKLIST${colors.reset}`);
    console.log('═'.repeat(50));
    this.tests.forEach((test, index) => {
      console.log(`${index + 1}. [ ] ${test}`);
    });

    console.log(`\\n${colors.red}${colors.bold}🚨 FAILURE INDICATORS TO WATCH FOR${colors.reset}`);
    console.log('═'.repeat(50));
    console.log('❌ Tables missing or incorrectly named');
    console.log('❌ Columns with wrong data types or constraints');
    console.log('❌ Missing foreign key relationships');
    console.log('❌ Data count mismatch between old and new tables');
    console.log('❌ Missing performance indexes');
    console.log('❌ Migration flag not set to "true"');
    
    console.log(`\\n${colors.blue}${colors.bold}🔧 ROLLBACK PLAN (If Issues Found)${colors.reset}`);
    console.log('═'.repeat(50));
    console.log('1. Stop the application immediately');
    console.log('2. The old user_profiles table is preserved');
    console.log('3. Remove new tables if needed:');
    console.log('   DROP TABLE IF EXISTS user_system_data CASCADE;');
    console.log('   DROP TABLE IF EXISTS user_usage CASCADE;');
    console.log('   DROP TABLE IF EXISTS user_billing CASCADE;');
    console.log('   DROP TABLE IF EXISTS user_subscriptions CASCADE;');
    console.log('   DROP TABLE IF EXISTS users CASCADE;');
    console.log('4. Revert code changes via git reset');
    console.log('5. Restart application with old schema');
  }

  generateTestDataQueries() {
    console.log(`\\n${colors.yellow}${colors.bold}🧪 OPTIONAL: CREATE TEST DATA${colors.reset}`);
    console.log('═'.repeat(50));
    console.log('If you want to test with sample data, run these MCP commands:\\n');

    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(`-- Create test user data
INSERT INTO users (user_id, email, full_name, business_name, onboarding_step) 
VALUES ('test_user_001', 'test@example.com', 'Test User', 'Test Company', 'completed')
ON CONFLICT (user_id) DO NOTHING;

-- Create subscription data for test user
INSERT INTO user_subscriptions (user_id, current_plan, trial_status, subscription_status)
SELECT id, 'glow_up', 'converted', 'active' 
FROM users WHERE user_id = 'test_user_001'
ON CONFLICT (user_id) DO NOTHING;

-- Create usage data
INSERT INTO user_usage (user_id, usage_campaigns_current, usage_creators_current_month)
SELECT id, 3, 250
FROM users WHERE user_id = 'test_user_001' 
ON CONFLICT (user_id) DO NOTHING;`);
    console.log('```\\n');

    console.log('Then verify the test data:');
    console.log(`${colors.blue}mcp__supabase__execute_sql${colors.reset}`);
    console.log('Query:');
    console.log(`\`\`\`sql`);
    console.log(`SELECT 
  u.user_id,
  u.email,
  us.current_plan,
  us.trial_status,
  uu.usage_campaigns_current
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id  
LEFT JOIN user_usage uu ON u.id = uu.user_id
WHERE u.user_id = 'test_user_001';`);
    console.log('```');
  }
}

// Run the verifier
if (require.main === module) {
  const verifier = new MCPDatabaseVerifier();
  verifier.generateMCPInstructions();
  verifier.generateTestDataQueries();
  
  console.log(`\\n${colors.green}${colors.bold}🎉 MCP VERIFICATION GUIDE READY!${colors.reset}`);
  console.log('Copy the commands above and run them in Claude Code with MCP access.');
}

module.exports = { MCPDatabaseVerifier };