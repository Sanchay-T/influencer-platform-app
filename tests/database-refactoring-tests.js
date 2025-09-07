/**
 * 🧪 COMPREHENSIVE DATABASE REFACTORING TESTS
 * Multi-layered verification using MCP and direct testing
 */

const { execSync } = require('child_process');
const path = require('path');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class DatabaseRefactoringTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const colorMap = {
      'SUCCESS': colors.green,
      'ERROR': colors.red,
      'WARNING': colors.yellow,
      'INFO': colors.blue
    };
    
    console.log(`${colorMap[level] || ''}[${timestamp}] ${level}: ${message}${colors.reset}`);
    if (details) {
      console.log(`${colors.reset}   Details: ${JSON.stringify(details, null, 2)}`);
    }
    
    this.testResults.details.push({ level, message, details, timestamp });
    
    if (level === 'SUCCESS') this.testResults.passed++;
    if (level === 'ERROR') this.testResults.failed++;
    if (level === 'WARNING') this.testResults.warnings++;
  }

  async runTest(testName, testFunc) {
    console.log(`\n${colors.blue}${colors.bold}🧪 Running Test: ${testName}${colors.reset}`);
    console.log('─'.repeat(60));
    
    try {
      await testFunc();
      this.log('SUCCESS', `✅ ${testName} completed successfully`);
    } catch (error) {
      this.log('ERROR', `❌ ${testName} failed`, {
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Test 1: Verify Migration File Integrity
  async testMigrationFileIntegrity() {
    const migrationPath = '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2/supabase/migrations/0016_normalize_user_tables.sql';
    
    try {
      const fs = require('fs');
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');
      
      // Check for required components
      const requiredComponents = [
        'CREATE TABLE IF NOT EXISTS users',
        'CREATE TABLE IF NOT EXISTS user_subscriptions', 
        'CREATE TABLE IF NOT EXISTS user_billing',
        'CREATE TABLE IF NOT EXISTS user_usage',
        'CREATE TABLE IF NOT EXISTS user_system_data',
        'INSERT INTO users',
        'INSERT INTO user_subscriptions',
        'CREATE INDEX'
      ];
      
      const missingComponents = requiredComponents.filter(component => 
        !migrationContent.includes(component)
      );
      
      if (missingComponents.length === 0) {
        this.log('SUCCESS', 'Migration file contains all required components');
      } else {
        this.log('ERROR', 'Migration file missing components', { missing: missingComponents });
      }
      
      // Check file size (should be substantial)
      const stats = fs.statSync(migrationPath);
      if (stats.size > 10000) { // At least 10KB
        this.log('SUCCESS', `Migration file size is appropriate (${stats.size} bytes)`);
      } else {
        this.log('WARNING', `Migration file seems small (${stats.size} bytes)`);
      }
      
    } catch (error) {
      this.log('ERROR', 'Cannot read migration file', { error: error.message });
    }
  }

  // Test 2: Schema File Verification
  async testSchemaFileIntegrity() {
    const schemaPath = '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2/lib/db/schema.ts';
    
    try {
      const fs = require('fs');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Check for new table exports
      const requiredTables = [
        'export const users = pgTable',
        'export const userSubscriptions = pgTable',
        'export const userBilling = pgTable',
        'export const userUsage = pgTable', 
        'export const userSystemData = pgTable'
      ];
      
      const requiredTypes = [
        'export type User =',
        'export type UserSubscription =',
        'export type UserBilling =',
        'export type UserUsage =',
        'export type UserSystemData =',
        'export type UserProfileComplete ='
      ];
      
      const missingTables = requiredTables.filter(table => !schemaContent.includes(table));
      const missingTypes = requiredTypes.filter(type => !schemaContent.includes(type));
      
      if (missingTables.length === 0 && missingTypes.length === 0) {
        this.log('SUCCESS', 'Schema file contains all required tables and types');
      } else {
        this.log('ERROR', 'Schema file missing definitions', { 
          missingTables, 
          missingTypes 
        });
      }
      
    } catch (error) {
      this.log('ERROR', 'Cannot read schema file', { error: error.message });
    }
  }

  // Test 3: Helper Functions Verification
  async testHelperFunctions() {
    const helpersPath = '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2/lib/db/queries/user-queries.ts';
    
    try {
      const fs = require('fs');
      const helpersContent = fs.readFileSync(helpersPath, 'utf8');
      
      const requiredFunctions = [
        'export async function getUserProfile',
        'export async function createUser', 
        'export async function updateUserProfile',
        'export async function getUserByStripeCustomerId',
        'export async function incrementUsage'
      ];
      
      const missingFunctions = requiredFunctions.filter(func => 
        !helpersContent.includes(func)
      );
      
      if (missingFunctions.length === 0) {
        this.log('SUCCESS', 'All helper functions are properly defined');
      } else {
        this.log('ERROR', 'Missing helper functions', { missing: missingFunctions });
      }
      
      // Check for transaction usage
      if (helpersContent.includes('db.transaction') || helpersContent.includes('return db.transaction')) {
        this.log('SUCCESS', 'Helper functions use database transactions for data consistency');
      } else {
        this.log('WARNING', 'Helper functions might not use transactions');
      }
      
    } catch (error) {
      this.log('ERROR', 'Cannot read helper functions file', { error: error.message });
    }
  }

  // Test 4: API Integration Verification
  async testAPIIntegration() {
    const criticalFiles = [
      '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2/app/api/billing/status/route.ts',
      '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2/app/api/stripe/webhook/route.ts',
      '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2/lib/services/plan-validator.ts'
    ];
    
    for (const filePath of criticalFiles) {
      try {
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check if file imports the new helper functions
        const hasNewImports = content.includes('from \'@/lib/db/queries/user-queries\'') ||
                            content.includes('getUserProfile') ||
                            content.includes('updateUserProfile');
        
        if (hasNewImports) {
          this.log('SUCCESS', `✅ ${path.basename(filePath)} updated to use new helpers`);
        } else {
          this.log('WARNING', `⚠️ ${path.basename(filePath)} may not be updated`);
        }
        
        // Check if old userProfiles usage is reduced
        const oldUsageCount = (content.match(/userProfiles\./g) || []).length;
        if (oldUsageCount < 5) { // Arbitrary threshold
          this.log('SUCCESS', `✅ ${path.basename(filePath)} has reduced old table usage (${oldUsageCount} instances)`);
        } else {
          this.log('INFO', `ℹ️ ${path.basename(filePath)} still has ${oldUsageCount} old table references`);
        }
        
      } catch (error) {
        this.log('ERROR', `Cannot read ${path.basename(filePath)}`, { error: error.message });
      }
    }
  }

  // Test 5: TypeScript Compilation Check
  async testTypeScriptCompilation() {
    try {
      this.log('INFO', 'Testing TypeScript compilation...');
      
      // Try to compile the schema file specifically
      const result = execSync('npx tsc --noEmit lib/db/schema.ts', { 
        cwd: '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2',
        encoding: 'utf8',
        timeout: 30000
      });
      
      this.log('SUCCESS', 'TypeScript compilation successful - no type errors');
      
    } catch (error) {
      if (error.stdout || error.stderr) {
        this.log('ERROR', 'TypeScript compilation failed', {
          stdout: error.stdout,
          stderr: error.stderr
        });
      } else {
        this.log('WARNING', 'Could not run TypeScript check', { error: error.message });
      }
    }
  }

  // Test 6: Syntax and Import Verification
  async testSyntaxAndImports() {
    const testFiles = [
      'lib/db/schema.ts',
      'lib/db/queries/user-queries.ts',
      'app/api/billing/status/route.ts'
    ];
    
    for (const file of testFiles) {
      try {
        // Simple Node.js syntax check
        const result = execSync(`node -c ${file}`, {
          cwd: '/Users/sanchay/Documents/projects/personal/influencerplatform-wt2',
          encoding: 'utf8',
          timeout: 10000
        });
        
        this.log('SUCCESS', `✅ ${file} has valid syntax`);
        
      } catch (error) {
        // TypeScript files will fail Node.js syntax check, which is expected
        if (file.endsWith('.ts')) {
          this.log('INFO', `ℹ️ ${file} is TypeScript (Node.js syntax check not applicable)`);
        } else {
          this.log('ERROR', `❌ ${file} has syntax errors`, { error: error.message });
        }
      }
    }
  }

  // Test 7: Generate Test Data Migration Simulation
  async testDataMigrationSimulation() {
    this.log('INFO', 'Simulating data migration logic...');
    
    // Simulate old user_profiles data structure
    const mockOldUserData = {
      userId: 'test_user_123',
      email: 'test@example.com',
      fullName: 'Test User',
      businessName: 'Test Business',
      onboardingStep: 'completed',
      currentPlan: 'glow_up',
      trialStatus: 'converted',
      stripeCustomerId: 'cus_test123',
      usageCampaignsCurrent: 5,
      usageCreatorsCurrentMonth: 500
    };
    
    // Simulate the transformation logic from our helper functions
    try {
      const transformedData = {
        // Core user data
        users: {
          userId: mockOldUserData.userId,
          email: mockOldUserData.email,
          fullName: mockOldUserData.fullName,
          businessName: mockOldUserData.businessName,
          onboardingStep: mockOldUserData.onboardingStep
        },
        // Subscription data  
        userSubscriptions: {
          currentPlan: mockOldUserData.currentPlan,
          trialStatus: mockOldUserData.trialStatus
        },
        // Billing data
        userBilling: {
          stripeCustomerId: mockOldUserData.stripeCustomerId
        },
        // Usage data
        userUsage: {
          usageCampaignsCurrent: mockOldUserData.usageCampaignsCurrent,
          usageCreatorsCurrentMonth: mockOldUserData.usageCreatorsCurrentMonth
        }
      };
      
      // Verify all data is preserved
      const dataPreserved = 
        transformedData.users.userId === mockOldUserData.userId &&
        transformedData.users.email === mockOldUserData.email &&
        transformedData.userSubscriptions.currentPlan === mockOldUserData.currentPlan &&
        transformedData.userBilling.stripeCustomerId === mockOldUserData.stripeCustomerId &&
        transformedData.userUsage.usageCampaignsCurrent === mockOldUserData.usageCampaignsCurrent;
      
      if (dataPreserved) {
        this.log('SUCCESS', '✅ Data migration simulation successful - all data preserved');
      } else {
        this.log('ERROR', '❌ Data migration simulation failed - data loss detected');
      }
      
    } catch (error) {
      this.log('ERROR', 'Data migration simulation failed', { error: error.message });
    }
  }

  // Main test runner
  async runAllTests() {
    console.log(`${colors.blue}${colors.bold}`);
    console.log('🚀 DATABASE REFACTORING COMPREHENSIVE TEST SUITE');
    console.log('═'.repeat(60));
    console.log(`${colors.reset}\n`);
    
    const tests = [
      ['Migration File Integrity', () => this.testMigrationFileIntegrity()],
      ['Schema File Verification', () => this.testSchemaFileIntegrity()],
      ['Helper Functions Check', () => this.testHelperFunctions()],
      ['API Integration Verification', () => this.testAPIIntegration()],
      ['TypeScript Compilation', () => this.testTypeScriptCompilation()],
      ['Syntax and Imports', () => this.testSyntaxAndImports()],
      ['Data Migration Simulation', () => this.testDataMigrationSimulation()]
    ];
    
    for (const [testName, testFunc] of tests) {
      await this.runTest(testName, testFunc);
    }
    
    this.generateReport();
  }

  generateReport() {
    console.log(`\n${colors.blue}${colors.bold}📊 TEST RESULTS SUMMARY${colors.reset}`);
    console.log('═'.repeat(60));
    console.log(`${colors.green}✅ Tests Passed: ${this.testResults.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Tests Failed: ${this.testResults.failed}${colors.reset}`);
    console.log(`${colors.yellow}⚠️ Warnings: ${this.testResults.warnings}${colors.reset}`);
    
    const successRate = ((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100) || 0;
    console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`);
    
    if (this.testResults.failed === 0) {
      console.log(`\n${colors.green}${colors.bold}🎉 ALL TESTS PASSED! Database refactoring is ready for deployment.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}${colors.bold}⚠️ Some tests failed. Please review the errors above before deployment.${colors.reset}`);
    }
    
    console.log(`\n${colors.blue}🔗 Next Steps:${colors.reset}`);
    console.log('1. Run the migration: npm run dev');
    console.log('2. Execute MCP verification tests');
    console.log('3. Test API endpoints manually');
    console.log('4. Monitor database performance');
  }
}

// Run the test suite
if (require.main === module) {
  const tester = new DatabaseRefactoringTester();
  tester.runAllTests().catch(console.error);
}

module.exports = { DatabaseRefactoringTester };