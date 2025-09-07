#!/usr/bin/env node
/**
 * 🚀 MASTER TEST RUNNER
 * Comprehensive verification of database refactoring implementation
 */

const { DatabaseRefactoringTester } = require('./tests/database-refactoring-tests.js');
const { APIIntegrationTester } = require('./tests/api-integration-tests.js');
const { DataIntegrityTester } = require('./tests/data-integrity-tests.js');
const { MCPDatabaseVerifier } = require('./tests/mcp-database-verification.js');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class MasterTestRunner {
  constructor() {
    this.overallResults = {
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalWarnings: 0,
      suites: []
    };
  }

  async runTestSuite(suiteName, tester) {
    console.log(`${colors.blue}${colors.bold}`);
    console.log(`🧪 RUNNING TEST SUITE: ${suiteName}`);
    console.log('═'.repeat(70));
    console.log(`${colors.reset}`);

    const startTime = Date.now();
    
    try {
      await tester.runAllTests();
      
      // Extract results if available
      const suiteResults = {
        name: suiteName,
        passed: tester.testResults?.passed || 0,
        failed: tester.testResults?.failed || 0,
        warnings: tester.testResults?.warnings || 0,
        duration: Date.now() - startTime,
        status: (tester.testResults?.failed || 0) === 0 ? 'PASSED' : 'FAILED'
      };

      this.overallResults.suites.push(suiteResults);
      this.overallResults.totalPassed += suiteResults.passed;
      this.overallResults.totalFailed += suiteResults.failed;
      this.overallResults.totalWarnings += suiteResults.warnings;
      this.overallResults.totalTests += (suiteResults.passed + suiteResults.failed);

      console.log(`${colors.blue}${colors.bold}`);
      console.log(`✅ ${suiteName} COMPLETED (${suiteResults.duration}ms)`);
      console.log(`${colors.reset}\n`);

    } catch (error) {
      console.error(`${colors.red}❌ ${suiteName} FAILED: ${error.message}${colors.reset}`);
      
      this.overallResults.suites.push({
        name: suiteName,
        passed: 0,
        failed: 1,
        warnings: 0,
        duration: Date.now() - startTime,
        status: 'ERROR',
        error: error.message
      });
      this.overallResults.totalFailed += 1;
      this.overallResults.totalTests += 1;
    }
  }

  generateFinalReport() {
    console.log(`${colors.blue}${colors.bold}`);
    console.log('🏆 DATABASE REFACTORING - FINAL TEST REPORT');
    console.log('═'.repeat(70));
    console.log(`${colors.reset}\n`);

    // Overall statistics
    const successRate = this.overallResults.totalTests > 0 
      ? ((this.overallResults.totalPassed / this.overallResults.totalTests) * 100).toFixed(1)
      : 0;

    console.log(`${colors.blue}📊 OVERALL STATISTICS:${colors.reset}`);
    console.log(`   Total Tests: ${this.overallResults.totalTests}`);
    console.log(`   ${colors.green}✅ Passed: ${this.overallResults.totalPassed}${colors.reset}`);
    console.log(`   ${colors.red}❌ Failed: ${this.overallResults.totalFailed}${colors.reset}`);
    console.log(`   ${colors.yellow}⚠️ Warnings: ${this.overallResults.totalWarnings}${colors.reset}`);
    console.log(`   📈 Success Rate: ${successRate}%\n`);

    // Suite breakdown
    console.log(`${colors.blue}📋 TEST SUITE BREAKDOWN:${colors.reset}`);
    console.log('─'.repeat(70));

    for (const suite of this.overallResults.suites) {
      const statusIcon = suite.status === 'PASSED' ? '✅' : suite.status === 'FAILED' ? '❌' : '💥';
      const statusColor = suite.status === 'PASSED' ? colors.green : colors.red;
      
      console.log(`${statusIcon} ${suite.name}`);
      console.log(`   ${statusColor}Status: ${suite.status}${colors.reset}`);
      console.log(`   Passed: ${suite.passed} | Failed: ${suite.failed} | Warnings: ${suite.warnings}`);
      console.log(`   Duration: ${suite.duration}ms`);
      
      if (suite.error) {
        console.log(`   ${colors.red}Error: ${suite.error}${colors.reset}`);
      }
      console.log('');
    }

    // Deployment readiness assessment
    console.log(`${colors.blue}${colors.bold}🎯 DEPLOYMENT READINESS ASSESSMENT:${colors.reset}`);
    console.log('═'.repeat(50));

    const criticalFailures = this.overallResults.suites.filter(s => 
      s.status === 'FAILED' || s.status === 'ERROR'
    );

    if (criticalFailures.length === 0 && successRate >= 95) {
      console.log(`${colors.green}${colors.bold}🎉 READY FOR DEPLOYMENT!${colors.reset}`);
      console.log(`${colors.green}✅ All critical tests passed${colors.reset}`);
      console.log(`${colors.green}✅ Success rate above 95%${colors.reset}`);
      console.log(`${colors.green}✅ No blocking issues detected${colors.reset}\n`);
      
      this.generateDeploymentInstructions();
    } else if (criticalFailures.length === 0 && successRate >= 80) {
      console.log(`${colors.yellow}${colors.bold}⚠️ PROCEED WITH CAUTION${colors.reset}`);
      console.log(`${colors.yellow}⚠️ Some non-critical tests failed${colors.reset}`);
      console.log(`${colors.yellow}⚠️ Review warnings before deployment${colors.reset}`);
      console.log(`${colors.yellow}⚠️ Success rate: ${successRate}%${colors.reset}\n`);
      
      this.generateCautionaryInstructions();
    } else {
      console.log(`${colors.red}${colors.bold}🚫 NOT READY FOR DEPLOYMENT${colors.reset}`);
      console.log(`${colors.red}❌ Critical failures detected: ${criticalFailures.length}${colors.reset}`);
      console.log(`${colors.red}❌ Success rate too low: ${successRate}%${colors.reset}`);
      console.log(`${colors.red}❌ Address failures before proceeding${colors.reset}\n`);
      
      this.generateFailureInstructions(criticalFailures);
    }
  }

  generateDeploymentInstructions() {
    console.log(`${colors.green}${colors.bold}🚀 DEPLOYMENT INSTRUCTIONS:${colors.reset}`);
    console.log('─'.repeat(40));
    console.log('1. ✅ Run the migration:');
    console.log('   npm run dev (will auto-apply migration)');
    console.log('');
    console.log('2. ✅ Verify with MCP commands:');
    console.log('   node tests/mcp-database-verification.js');
    console.log('');
    console.log('3. ✅ Test critical API endpoints:');
    console.log('   • GET /api/billing/status');
    console.log('   • POST /api/stripe/webhook');
    console.log('   • Test user registration flow');
    console.log('');
    console.log('4. ✅ Monitor performance:');
    console.log('   • Check response times');
    console.log('   • Verify database query performance');
    console.log('   • Monitor error rates');
    console.log('');
    console.log(`${colors.blue}🔗 Rollback plan available if needed${colors.reset}\n`);
  }

  generateCautionaryInstructions() {
    console.log(`${colors.yellow}${colors.bold}⚠️ CAUTIONARY DEPLOYMENT:${colors.reset}`);
    console.log('─'.repeat(40));
    console.log('1. 🟨 Deploy during low-traffic hours');
    console.log('2. 🟨 Have rollback plan ready');
    console.log('3. 🟨 Monitor closely for 24 hours');
    console.log('4. 🟨 Review warning messages in logs');
    console.log('5. 🟨 Test all critical user flows manually\n');
  }

  generateFailureInstructions(failures) {
    console.log(`${colors.red}${colors.bold}🚫 DEPLOYMENT BLOCKED:${colors.reset}`);
    console.log('─'.repeat(40));
    console.log('Critical issues must be resolved:');
    
    failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${colors.red}${failure.name}: ${failure.status}${colors.reset}`);
      if (failure.error) {
        console.log(`   Error: ${failure.error}`);
      }
    });
    
    console.log('');
    console.log(`${colors.red}🔧 RECOMMENDED ACTIONS:${colors.reset}`);
    console.log('1. Review error messages above');
    console.log('2. Fix code or configuration issues');
    console.log('3. Re-run tests: node run-all-tests.js');
    console.log('4. Do not deploy until all tests pass');
  }

  async runAllTests() {
    console.log(`${colors.blue}${colors.bold}`);
    console.log('🎯 DATABASE REFACTORING COMPREHENSIVE TEST SUITE');
    console.log('Testing database normalization from user_profiles to 5 tables');
    console.log('═'.repeat(70));
    console.log(`${colors.reset}\n`);

    // Test Suite 1: File and Code Integrity  
    const dbTester = new DatabaseRefactoringTester();
    await this.runTestSuite('Database Refactoring Tests', dbTester);

    // Test Suite 2: API Integration
    const apiTester = new APIIntegrationTester();
    await this.runTestSuite('API Integration Tests', apiTester);

    // Test Suite 3: Data Integrity and Rollback Safety
    const integrityTester = new DataIntegrityTester();
    await this.runTestSuite('Data Integrity & Rollback Tests', integrityTester);

    // Generate final report
    this.generateFinalReport();
    
    // Generate MCP verification guide
    console.log(`${colors.blue}${colors.bold}🔍 MCP VERIFICATION COMMANDS:${colors.reset}`);
    console.log('Run the following for database verification:');
    console.log(`${colors.yellow}node tests/mcp-database-verification.js${colors.reset}\n`);

    // Exit with appropriate code
    const hasFailures = this.overallResults.totalFailed > 0;
    process.exit(hasFailures ? 1 : 0);
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new MasterTestRunner();
  runner.runAllTests().catch(error => {
    console.error(`${colors.red}${colors.bold}💥 FATAL ERROR: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { MasterTestRunner };