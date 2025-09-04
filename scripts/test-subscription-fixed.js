#!/usr/bin/env node

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3002';
const API_URL = `${BASE_URL}/api/test/subscription`;

class SubscriptionSystemTester {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runTest(name, testFn) {
    console.log(`\n🧪 Running: ${name}`);
    try {
      const result = await testFn();
      if (result.passed) {
        console.log(`✅ PASSED: ${name}`);
        this.passed++;
      } else {
        console.log(`❌ FAILED: ${name} - ${result.message}`);
        this.failed++;
      }
      this.results.push({ name, ...result });
    } catch (error) {
      console.log(`💥 ERROR: ${name} - ${error.message}`);
      this.failed++;
      this.results.push({ name, passed: false, message: error.message });
    }
  }

  async apiCall(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  async setupTestUsers() {
    console.log('🔧 Setting up test users...');
    const result = await this.apiCall('?action=create-users');
    if (!result.success) {
      throw new Error('Failed to create test users');
    }
    console.log('✅ Test users created');
  }

  async testGlowUpCampaignLimits() {
    return this.runTest('Glow Up: Campaign Limits (3 max)', async () => {
      // Reset usage first
      await this.apiCall('?action=reset-usage&userId=test_glow_up_user');
      
      // Try to create 4 campaigns (should create 3, fail 1)
      const result = await this.apiCall('?action=create-campaigns&userId=test_glow_up_user&count=4');
      
      const passed = result.results.success === 3 && result.results.failed === 1;
      return {
        passed,
        message: passed ? 'Created 3/4 campaigns as expected' : `Created ${result.results.success}/4, expected 3/4`,
        details: result.results
      };
    });
  }

  async testGlowUpCreatorLimits() {
    return this.runTest('Glow Up: Creator Limits (1000 max)', async () => {
      // Reset usage first
      await this.apiCall('?action=reset-usage&userId=test_glow_up_user');
      
      // Use 1000 creators (should pass)
      const result1 = await this.apiCall('?action=use-creators&userId=test_glow_up_user&count=1000');
      
      // Try to use 1 more (should fail)
      const result2 = await this.apiCall('?action=use-creators&userId=test_glow_up_user&count=1');
      
      const passed = result1.success && !result2.success;
      return {
        passed,
        message: passed ? '1000 creators allowed, 1001st blocked' : 'Creator limits not working correctly',
        details: { first: result1, second: result2 }
      };
    });
  }

  async runAllTests() {
    console.log('\n🚀 Starting Subscription System Test Suite\n');
    console.log('='.repeat(60));

    try {
      // Setup
      await this.setupTestUsers();

      // Run tests
      await this.testGlowUpCampaignLimits();
      await this.testGlowUpCreatorLimits();

      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('🏁 TEST SUITE COMPLETE');
      console.log(`✅ Passed: ${this.passed}`);
      console.log(`❌ Failed: ${this.failed}`);
      console.log(`📊 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);
      
      if (this.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Your subscription system is working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Check the details above.');
      }

    } catch (error) {
      console.error('\n💥 Test suite failed to run:', error.message);
      process.exit(1);
    }

    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Run the tests
if (require.main === module) {
  const tester = new SubscriptionSystemTester();
  tester.runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = SubscriptionSystemTester;