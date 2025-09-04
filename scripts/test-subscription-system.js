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
      };\n    });\n  }\n\n  async testViralSurgeLimits() {\n    return this.runTest('Viral Surge: Limits (10 campaigns, 10k creators)', async () => {\n      // Reset usage first\n      await this.apiCall('?action=reset-usage&userId=test_viral_surge_user');\n      \n      // Test campaigns (should create 10, fail 11th)\n      const campaignResult = await this.apiCall('?action=create-campaigns&userId=test_viral_surge_user&count=11');\n      \n      // Reset for creator test\n      await this.apiCall('?action=reset-usage&userId=test_viral_surge_user');\n      \n      // Test creators (10k should pass)\n      const creatorResult = await this.apiCall('?action=use-creators&userId=test_viral_surge_user&count=10000');\n      \n      const passed = campaignResult.results.success === 10 && \n                    campaignResult.results.failed === 1 && \n                    creatorResult.success;\n      \n      return {\n        passed,\n        message: passed ? 'Viral Surge limits working correctly' : 'Viral Surge limits failed',\n        details: { campaigns: campaignResult.results, creators: creatorResult }\n      };\n    });\n  }\n\n  async testFameFlexUnlimited() {\n    return this.runTest('Fame Flex: Unlimited Access', async () => {\n      // Reset usage first\n      await this.apiCall('?action=reset-usage&userId=test_fame_flex_user');\n      \n      // Test many campaigns (should all pass)\n      const campaignResult = await this.apiCall('?action=create-campaigns&userId=test_fame_flex_user&count=15');\n      \n      // Test many creators (should pass)\n      const creatorResult = await this.apiCall('?action=use-creators&userId=test_fame_flex_user&count=15000');\n      \n      const passed = campaignResult.results.success === 15 && \n                    campaignResult.results.failed === 0 && \n                    creatorResult.success;\n      \n      return {\n        passed,\n        message: passed ? 'Fame Flex unlimited access working' : 'Fame Flex limits not unlimited',\n        details: { campaigns: campaignResult.results, creators: creatorResult }\n      };\n    });\n  }\n\n  async testPlanSwitching() {\n    return this.runTest('Plan Switching: Glow Up -> Viral Surge', async () => {\n      const userId = 'test_glow_up_user';\n      \n      // Reset and fill Glow Up limits\n      await this.apiCall(`?action=reset-usage&userId=${userId}`);\n      await this.apiCall(`?action=create-campaigns&userId=${userId}&count=3`); // Fill to limit\n      \n      // Try to create another (should fail)\n      const failResult = await this.apiCall(`?action=create-campaigns&userId=${userId}&count=1`);\n      \n      // Switch to Viral Surge\n      await this.apiCall(`?action=switch-plan&userId=${userId}&plan=viral_surge`);\n      \n      // Now should be able to create more campaigns\n      const successResult = await this.apiCall(`?action=create-campaigns&userId=${userId}&count=5`);\n      \n      const passed = failResult.results.failed === 1 && successResult.results.success === 5;\n      \n      return {\n        passed,\n        message: passed ? 'Plan switching allows higher limits' : 'Plan switching failed',\n        details: { beforeSwitch: failResult.results, afterSwitch: successResult.results }\n      };\n    });\n  }\n\n  async testUsageTracking() {\n    return this.runTest('Usage Tracking Accuracy', async () => {\n      const userId = 'test_glow_up_user';\n      \n      // Reset usage\n      await this.apiCall(`?action=reset-usage&userId=${userId}`);\n      \n      // Create 2 campaigns\n      await this.apiCall(`?action=create-campaigns&userId=${userId}&count=2`);\n      \n      // Use 500 creators\n      await this.apiCall(`?action=use-creators&userId=${userId}&count=500`);\n      \n      // Check status\n      const status = await this.apiCall(`?action=get-status&userId=${userId}`);\n      \n      const campaignsCorrect = status.status.usage.campaignsUsed === 2;\n      const creatorsCorrect = status.status.usage.creatorsUsed === 500;\n      \n      const passed = campaignsCorrect && creatorsCorrect;\n      \n      return {\n        passed,\n        message: passed ? 'Usage tracking accurate' : `Campaigns: ${status.status.usage.campaignsUsed}/2, Creators: ${status.status.usage.creatorsUsed}/500`,\n        details: status.status.usage\n      };\n    });\n  }\n\n  async testUpgradeSuggestions() {\n    return this.runTest('Upgrade Suggestions', async () => {\n      const userId = 'test_glow_up_limit';\n      \n      // This user should be at limits and get upgrade suggestions\n      const status = await this.apiCall(`?action=get-status&userId=${userId}`);\n      \n      const hasUpgradeSuggestion = status.status.upgradeSuggestion?.shouldUpgrade;\n      const suggestsViralSurge = status.status.upgradeSuggestion?.suggestedPlan === 'viral_surge';\n      \n      const passed = hasUpgradeSuggestion && suggestsViralSurge;\n      \n      return {\n        passed,\n        message: passed ? 'Upgrade suggestions working' : 'No upgrade suggestions when at limits',\n        details: status.status.upgradeSuggestion\n      };\n    });\n  }\n\n  async runAllTests() {\n    console.log('\n🚀 Starting Subscription System Test Suite\\n');\n    console.log('=' .repeat(60));\n\n    try {\n      // Setup\n      await this.setupTestUsers();\n\n      // Run all tests\n      await this.testGlowUpCampaignLimits();\n      await this.testGlowUpCreatorLimits();\n      await this.testViralSurgeLimits();\n      await this.testFameFlexUnlimited();\n      await this.testPlanSwitching();\n      await this.testUsageTracking();\n      await this.testUpgradeSuggestions();\n\n      // Summary\n      console.log('\\n' + '=' .repeat(60));\n      console.log('🏁 TEST SUITE COMPLETE');\n      console.log(`✅ Passed: ${this.passed}`);\n      console.log(`❌ Failed: ${this.failed}`);\n      console.log(`📊 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);\n      \n      if (this.failed === 0) {\n        console.log('\\n🎉 ALL TESTS PASSED! Your subscription system is working correctly.');\n      } else {\n        console.log('\\n⚠️  Some tests failed. Check the details above.');\n      }\n\n      console.log('\\n📋 Detailed Results:');\n      this.results.forEach((result, index) => {\n        console.log(`${index + 1}. ${result.passed ? '✅' : '❌'} ${result.name}`);\n        if (result.details) {\n          console.log(`   Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}...`);\n        }\n      });\n\n    } catch (error) {\n      console.error('\\n💥 Test suite failed to run:', error.message);\n      process.exit(1);\n    }\n\n    process.exit(this.failed > 0 ? 1 : 0);\n  }\n}\n\n// Run the tests\nif (require.main === module) {\n  const tester = new SubscriptionSystemTester();\n  tester.runAllTests().catch(error => {\n    console.error('Fatal error:', error);\n    process.exit(1);\n  });\n}\n\nmodule.exports = SubscriptionSystemTester;\n"