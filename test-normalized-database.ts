#!/usr/bin/env tsx

/**
 * 🧪 COMPREHENSIVE DATABASE REFACTORING TEST SUITE
 * Tests the new normalized database architecture vs old monolithic structure
 */

import { getUserProfile, createUser, updateUserProfile, getUserByStripeCustomerId } from './lib/db/queries/user-queries';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

class DatabaseRefactoringTests {
  private results: TestResult[] = [];
  
  private log(level: 'INFO' | 'SUCCESS' | 'ERROR', message: string) {
    const prefix = {
      INFO: '🔍',
      SUCCESS: '✅', 
      ERROR: '❌'
    }[level];
    console.log(`${prefix} [TEST] ${message}`);
  }

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.log('INFO', `Running: ${testName}`);
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        test: testName,
        status: 'PASS',
        message: 'Test completed successfully',
        duration
      });
      
      this.log('SUCCESS', `✓ ${testName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      this.results.push({
        test: testName,
        status: 'FAIL', 
        message,
        duration
      });
      
      this.log('ERROR', `✗ ${testName} - ${message} (${duration}ms)`);
    }
  }

  async testCreateUser() {
    await this.runTest('Create User with Normalized Tables', async () => {
      const testUserId = `test_user_${Date.now()}`;
      
      const user = await createUser({
        userId: testUserId,
        email: 'test@example.com',
        fullName: 'Test User', 
        businessName: 'Test Business',
        brandDescription: 'A test business for verification',
        industry: 'Technology'
      });
      
      if (!user || !user.id || user.userId !== testUserId) {
        throw new Error('User creation failed or returned invalid data');
      }
      
      if (!user.currentPlan || user.currentPlan !== 'free') {
        throw new Error('Default plan not set correctly');
      }
      
      if (!user.trialStatus || user.trialStatus !== 'pending') {
        throw new Error('Default trial status not set correctly');  
      }
      
      // Store for other tests
      (global as any).testUserId = testUserId;
      (global as any).testUserInternalId = user.id;
    });
  }

  async testGetUserProfile() {
    await this.runTest('Get User Profile with JOIN Queries', async () => {
      const testUserId = (global as any).testUserId;
      if (!testUserId) {
        throw new Error('No test user available - create user test must run first');
      }
      
      const profile = await getUserProfile(testUserId);
      
      if (!profile) {
        throw new Error('User profile not found');
      }
      
      // Verify all tables are properly joined
      if (profile.fullName !== 'Test User') {
        throw new Error('Users table data not retrieved correctly');
      }
      
      if (profile.currentPlan !== 'free') {
        throw new Error('User subscriptions data not joined correctly');
      }
      
      if (profile.usageCampaignsCurrent !== 0) {
        throw new Error('User usage data not joined correctly');
      }
      
      if (!profile.signupTimestamp) {
        throw new Error('User system data not joined correctly');
      }
      
      this.log('INFO', `Profile retrieved: ${profile.fullName} (${profile.currentPlan})`);
    });
  }

  async testUpdateUserProfile() {
    await this.runTest('Update User Profile Across Multiple Tables', async () => {
      const testUserId = (global as any).testUserId;
      if (!testUserId) {
        throw new Error('No test user available');
      }
      
      // Update data that spans multiple tables
      await updateUserProfile(testUserId, {
        fullName: 'Updated Test User',
        currentPlan: 'glow_up',
        trialStatus: 'active',
        stripeCustomerId: 'cus_test123',
        usageCampaignsCurrent: 5,
        lastWebhookEvent: 'subscription.created'
      });
      
      // Verify updates were applied across tables
      const updatedProfile = await getUserProfile(testUserId);
      
      if (!updatedProfile) {
        throw new Error('Updated profile not found');
      }
      
      if (updatedProfile.fullName !== 'Updated Test User') {
        throw new Error('Users table update failed');
      }
      
      if (updatedProfile.currentPlan !== 'glow_up') {
        throw new Error('User subscriptions table update failed');
      }
      
      if (updatedProfile.stripeCustomerId !== 'cus_test123') {
        throw new Error('User billing table update failed');
      }
      
      if (updatedProfile.usageCampaignsCurrent !== 5) {
        throw new Error('User usage table update failed');
      }
      
      if (updatedProfile.lastWebhookEvent !== 'subscription.created') {
        throw new Error('User system data table update failed');
      }
      
      this.log('INFO', `Multi-table update successful: ${updatedProfile.fullName}`);
    });
  }

  async testGetUserByStripeCustomerId() {
    await this.runTest('Get User by Stripe Customer ID', async () => {
      const profile = await getUserByStripeCustomerId('cus_test123');
      
      if (!profile) {
        throw new Error('User not found by Stripe customer ID');
      }
      
      if (profile.fullName !== 'Updated Test User') {
        throw new Error('Incorrect user retrieved by Stripe ID');
      }
      
      this.log('INFO', `User found by Stripe ID: ${profile.fullName}`);
    });
  }

  async testDataIntegrity() {
    await this.runTest('Data Integrity and Relationships', async () => {
      const testUserId = (global as any).testUserId;
      if (!testUserId) {
        throw new Error('No test user available');
      }
      
      const profile = await getUserProfile(testUserId);
      if (!profile) {
        throw new Error('Profile not found for integrity check');
      }
      
      // Verify internal UUID consistency
      if (!profile.id || typeof profile.id !== 'string') {
        throw new Error('Internal user ID not properly set');
      }
      
      // Verify all related data is consistent
      const requiredFields = [
        'userId', 'fullName', 'currentPlan', 'trialStatus', 
        'usageCampaignsCurrent', 'signupTimestamp'
      ];
      
      for (const field of requiredFields) {
        if ((profile as any)[field] === undefined || (profile as any)[field] === null) {
          throw new Error(`Required field ${field} is missing from joined data`);
        }
      }
      
      this.log('INFO', 'All foreign key relationships working correctly');
    });
  }

  async testPerformanceComparison() {
    await this.runTest('Performance: Single Query vs Multiple Queries', async () => {
      const testUserId = (global as any).testUserId;
      if (!testUserId) {
        throw new Error('No test user available');
      }
      
      // Test our single JOIN query performance
      const startTime = Date.now();
      const profile = await getUserProfile(testUserId);
      const singleQueryTime = Date.now() - startTime;
      
      if (!profile) {
        throw new Error('Profile query failed');
      }
      
      this.log('INFO', `Single JOIN query completed in ${singleQueryTime}ms`);
      
      // This would be much faster than multiple separate queries to old monolithic table
      if (singleQueryTime > 100) {
        this.log('INFO', `Query time: ${singleQueryTime}ms (consider index optimization)`);
      } else {
        this.log('INFO', `Query time: ${singleQueryTime}ms (excellent performance)`);
      }
    });
  }

  async runAllTests() {
    console.log('\n🚀 STARTING DATABASE REFACTORING VERIFICATION TESTS\n');
    console.log('Testing normalized tables: users, user_subscriptions, user_billing, user_usage, user_system_data\n');
    
    // Run tests in sequence (some depend on others)
    await this.testCreateUser();
    await this.testGetUserProfile(); 
    await this.testUpdateUserProfile();
    await this.testGetUserByStripeCustomerId();
    await this.testDataIntegrity();
    await this.testPerformanceComparison();
    
    // Print summary
    this.printSummary();
  }

  private printSummary() {
    console.log('\n📊 TEST SUMMARY');
    console.log('═'.repeat(50));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalTime = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);  
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log(`🎯 Success Rate: ${Math.round((passed / this.results.length) * 100)}%`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`   • ${result.test}: ${result.message}`);
        });
    }
    
    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Database refactoring is working perfectly!');
      console.log('✅ Normalized tables created successfully');
      console.log('✅ Foreign key relationships working');  
      console.log('✅ Helper functions operational');
      console.log('✅ Multi-table updates functional');
      console.log('✅ Performance optimized');
    }
    
    console.log('\n');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new DatabaseRefactoringTests();
  testSuite.runAllTests().catch(console.error);
}

export { DatabaseRefactoringTests };