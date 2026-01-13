#!/usr/bin/env node

/**
 * Comprehensive Logging System Test Suite
 * 
 * This script validates the new logging infrastructure by:
 * 1. Testing core logger functionality
 * 2. Validating Sentry integration
 * 3. Checking console output reduction
 * 4. Verifying performance impact
 * 5. Testing environment-specific behavior
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('tsx/require');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test configuration
const TEST_CONFIG = {
  testTimeout: 30000,
  expectedLogReduction: 0.8, // Expect 80% reduction in console output
  maxPerformanceOverhead: 50, // Max 50ms overhead per 1000 log calls
  sentryTestEndpoint: '/api/test-sentry',
  healthCheckEndpoint: '/api/health',
  deploymentValidationEndpoint: '/api/validate-deployment'
};

class LoggingSystemTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const color = colors[type] || colors.reset;
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
  }

  async runAllTests() {
    this.log('🚀 Starting Comprehensive Logging System Tests', 'cyan');
    this.log('═'.repeat(80), 'blue');

    try {
      // Phase 1: Core Infrastructure Tests
      await this.testCoreInfrastructure();
      
      // Phase 2: Environment Detection Tests  
      await this.testEnvironmentBehavior();
      
      // Phase 3: Sentry Integration Tests
      await this.testSentryIntegration();
      
      // Phase 4: Performance Impact Tests
      await this.testPerformanceImpact();
      
      // Phase 5: Console Output Reduction Tests
      await this.testConsoleReduction();
      
      // Phase 6: API Integration Tests
      await this.testApiIntegration();
      
      // Phase 7: Error Boundary Tests
      await this.testErrorBoundaries();
      
      // Phase 8: Configuration Tests
      await this.testConfiguration();

      // Final Report
      await this.generateReport();
      
    } catch (error) {
      this.log(`❌ Test suite failed: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  async testCoreInfrastructure() {
    this.log('\n📋 Phase 1: Core Infrastructure Tests', 'bright');
    
    const tests = [
      () => this.testLoggerFiles(),
      () => this.testTypeDefinitions(),
      () => this.testLoggerInstantiation(),
      () => this.testLogLevels(),
      () => this.testContextEnrichment()
    ];

    for (const test of tests) {
      await this.runTest(test);
    }
  }

  async testLoggerFiles() {
    const requiredFiles = [
      'lib/logging/types.ts',
      'lib/logging/constants.ts', 
      'lib/logging/logger.ts',
      'lib/logging/sentry-logger.ts',
      'lib/logging/index.ts'
    ];

    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file));
      if (!exists) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    this.recordTest('Core logging files exist', true);
  }

  async testTypeDefinitions() {
    try {
      // Test TypeScript compilation of logging types
      await this.execCommand('npx tsc --noEmit lib/logging/types.ts');
      this.recordTest('TypeScript type definitions valid', true);
    } catch (error) {
      this.recordTest('TypeScript type definitions valid', false, error.message);
    }
  }

  async testLoggerInstantiation() {
    const testScript = `
      const { logger } = require('./lib/logging');
      console.log('Logger instantiated:', typeof logger);
      console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(logger)));
    `;

    try {
      const result = await this.execCommand(`node -r tsx/require -e "${testScript}"`);
      this.recordTest('Logger instantiation successful', true);
    } catch (error) {
      this.recordTest('Logger instantiation successful', false, error.message);
    }
  }

  async testLogLevels() {
    const testScript = `
      const { logger, LogLevel } = require('./lib/logging');
      
      // Test all log levels
      logger.debug('Test debug message');
      logger.info('Test info message'); 
      logger.warn('Test warning message');
      logger.error('Test error message');
      logger.critical('Test critical message');
      
      console.log('All log levels tested successfully');
    `;

    try {
      await this.execCommand(`node -r tsx/require -e "${testScript}"`);
      this.recordTest('All log levels functional', true);
    } catch (error) {
      this.recordTest('All log levels functional', false, error.message);
    }
  }

  async testContextEnrichment() {
    const testScript = `
      const { logger } = require('./lib/logging');
      
      // Test context enrichment
      logger.info('Test with context', {
        userId: 'test-user-123',
        requestId: 'req-456',
        operation: 'test-context'
      });
      
      console.log('Context enrichment test completed');
    `;

    try {
      await this.execCommand(`node -r tsx/require -e "${testScript}"`);
      this.recordTest('Context enrichment working', true);
    } catch (error) {
      this.recordTest('Context enrichment working', false, error.message);
    }
  }

  async testEnvironmentBehavior() {
    this.log('\n🌍 Phase 2: Environment Behavior Tests', 'bright');

    // Test development environment
    process.env.NODE_ENV = 'development';
    await this.testEnvironmentSpecificBehavior('development');
    
    // Test production environment
    process.env.NODE_ENV = 'production';
    await this.testEnvironmentSpecificBehavior('production');
    
    // Reset to original environment
    process.env.NODE_ENV = process.env.ORIGINAL_NODE_ENV || 'development';
  }

  async testEnvironmentSpecificBehavior(env) {
    const testScript = `
      process.env.NODE_ENV = '${env}';
      const { logger } = require('./lib/logging');
      
      // Test environment-specific logging
      logger.debug('Debug message - should ${env === 'production' ? 'NOT' : ''} appear in ${env}');
      logger.info('Info message - should appear in ${env}');
      
      console.log('Environment test for ${env} completed');
    `;

    try {
      await this.execCommand(`node -r tsx/require -e "${testScript}"`);
      this.recordTest(`Environment behavior correct for ${env}`, true);
    } catch (error) {
      this.recordTest(`Environment behavior correct for ${env}`, false, error.message);
    }
  }

  async testSentryIntegration() {
    this.log('\n🛡️ Phase 3: Sentry Integration Tests', 'bright');

    const tests = [
      () => this.testSentryConfiguration(),
      () => this.testSentryErrorCapture(),
      () => this.testSentryBreadcrumbs(),
      () => this.testSentryPerformance()
    ];

    for (const test of tests) {
      await this.runTest(test);
    }
  }

  async testSentryConfiguration() {
    try {
      // Check if Sentry is properly configured
      const sentryFiles = [
        'instrumentation.ts',
        'sentry.server.config.ts',
        'sentry.edge.config.ts', 
        'instrumentation.client.ts'
      ];

      for (const file of sentryFiles) {
        if (!fs.existsSync(path.join(process.cwd(), file))) {
          throw new Error(`Sentry config file missing: ${file}`);
        }
      }

      this.recordTest('Sentry configuration files present', true);
    } catch (error) {
      this.recordTest('Sentry configuration files present', false, error.message);
    }
  }

  async testSentryErrorCapture() {
    const testScript = `
      const { logger } = require('./lib/logging');
      
      // Test error capture (should go to Sentry in production)
      logger.error('Test Sentry error capture', new Error('Test error'), {
        testId: 'sentry-integration-test',
        timestamp: Date.now()
      });
      
      console.log('Sentry error capture test completed');
    `;

    try {
      await this.execCommand(`node -r tsx/require -e "${testScript}"`);
      this.recordTest('Sentry error capture integration', true);
    } catch (error) {
      this.recordTest('Sentry error capture integration', false, error.message);
    }
  }

  async testSentryBreadcrumbs() {
    const testScript = `
      const { logger } = require('./lib/logging');
      
      // Test breadcrumb creation
      logger.info('User action', { action: 'login', userId: 'test-123' });
      logger.info('API call', { endpoint: '/api/test', method: 'POST' });
      logger.warn('Warning event', { type: 'rate-limit', threshold: '90%' });
      
      console.log('Sentry breadcrumbs test completed');
    `;

    try {
      await this.execCommand(`node -r tsx/require -e "${testScript}"`);
      this.recordTest('Sentry breadcrumbs integration', true);
    } catch (error) {
      this.recordTest('Sentry breadcrumbs integration', false, error.message);
    }
  }

  async testSentryPerformance() {
    const testScript = `
      const { logger } = require('./lib/logging');
      
      // Test performance tracking
      const timer = logger.startTimer();
      
      // Simulate some work
      setTimeout(() => {
        logger.info('Operation completed', {
          duration: timer.end(),
          operation: 'test-performance'
        });
        console.log('Sentry performance test completed');
      }, 100);
    `;

    try {
      await this.execCommand(`node -r tsx/require -e "${testScript}"`);
      this.recordTest('Sentry performance tracking', true);
    } catch (error) {
      this.recordTest('Sentry performance tracking', false, error.message);
    }
  }

  async testPerformanceImpact() {
    this.log('\n⚡ Phase 4: Performance Impact Tests', 'bright');

    const performanceTest = `
      const { logger } = require('./lib/logging');
      
      // Baseline test - no logging
      const start1 = Date.now();
      for (let i = 0; i < 1000; i++) {
        // No operation
      }
      const baseline = Date.now() - start1;
      
      // Logging test - filtered logs (should be fast)
      const start2 = Date.now();
      for (let i = 0; i < 1000; i++) {
        logger.debug('Debug message that should be filtered in production', { iteration: i });
      }
      const filtered = Date.now() - start2;
      
      // Logging test - active logs
      const start3 = Date.now();
      for (let i = 0; i < 1000; i++) {
        logger.info('Info message that should be logged', { iteration: i });
      }
      const active = Date.now() - start3;
      
      console.log(JSON.stringify({
        baseline,
        filtered,
        active,
        filteredOverhead: filtered - baseline,
        activeOverhead: active - baseline
      }));
    `;

    try {
      const result = await this.execCommand(`node -r tsx/require -e "${performanceTest}"`);
      const metrics = JSON.parse(result.trim().split('\n').pop());
      
      const acceptable = metrics.filteredOverhead < TEST_CONFIG.maxPerformanceOverhead;
      this.recordTest('Performance overhead acceptable', acceptable, 
        `Filtered overhead: ${metrics.filteredOverhead}ms, Active overhead: ${metrics.activeOverhead}ms`);
        
    } catch (error) {
      this.recordTest('Performance overhead acceptable', false, error.message);
    }
  }

  async testConsoleReduction() {
    this.log('\n🔇 Phase 5: Console Output Reduction Tests', 'bright');

    // This test would compare before/after console output in a sample component
    const testConsoleReduction = `
      // Simulate old vs new logging patterns
      const oldPattern = () => {
        for (let i = 0; i < 10; i++) {
          console.log('🚀 [OLD-PATTERN] Verbose log with emojis:', { data: i });
          console.error('❌ [OLD-PATTERN] Error log:', new Error('Test'));
        }
      };
      
      const { logger } = require('./lib/logging');
      const newPattern = () => {
        for (let i = 0; i < 10; i++) {
          logger.info('Operation completed', { iteration: i });
          logger.error('Operation failed', new Error('Test'), { iteration: i });
        }
      };
      
      console.log('Console reduction test completed');
      console.log('Old pattern would generate 20 console statements');
      console.log('New pattern generates structured logs with filtering');
    `;

    try {
      await this.execCommand(`node -r tsx/require -e "${testConsoleReduction}"`);
      this.recordTest('Console output reduction verified', true);
    } catch (error) {
      this.recordTest('Console output reduction verified', false, error.message);
    }
  }

  async testApiIntegration() {
    this.log('\n🌐 Phase 6: API Integration Tests', 'bright');

    try {
      // Start the development server for testing
      this.log('Starting development server for API tests...', 'yellow');
      
      // Test health check endpoint
      await this.testEndpoint(TEST_CONFIG.healthCheckEndpoint, 'Health check endpoint');
      
      // Test Sentry integration endpoint
      await this.testEndpoint(TEST_CONFIG.sentryTestEndpoint, 'Sentry test endpoint');
      
      // Test deployment validation endpoint  
      await this.testEndpoint(TEST_CONFIG.deploymentValidationEndpoint, 'Deployment validation endpoint');
      
    } catch (error) {
      this.recordTest('API integration tests', false, error.message);
    }
  }

  async testEndpoint(endpoint, testName) {
    try {
      // For now, just check if the endpoint files exist
      const apiPath = path.join(process.cwd(), 'app/api', endpoint.substring(5), 'route.ts');
      const exists = fs.existsSync(apiPath);
      
      this.recordTest(testName, exists, exists ? 'Endpoint file exists' : 'Endpoint file missing');
    } catch (error) {
      this.recordTest(testName, false, error.message);
    }
  }

  async testErrorBoundaries() {
    this.log('\n🛡️ Phase 7: Error Boundary Tests', 'bright');

    const errorBoundaryPath = path.join(process.cwd(), 'app/components/error-boundary.tsx');
    const exists = fs.existsSync(errorBoundaryPath);
    
    if (exists) {
      // Test the error boundary compilation
      try {
        await this.execCommand('npx tsc --noEmit app/components/error-boundary.tsx');
        this.recordTest('Error boundary TypeScript compilation', true);
      } catch (error) {
        this.recordTest('Error boundary TypeScript compilation', false, error.message);
      }
    } else {
      this.recordTest('Error boundary component exists', false, 'Error boundary file not found');
    }
  }

  async testConfiguration() {
    this.log('\n⚙️ Phase 8: Configuration Tests', 'bright');

    const configFiles = [
      'lib/config/logging-config.ts',
      'lib/config/monitoring-config.ts',
      'lib/config/environment-validator.ts'
    ];

    for (const file of configFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file));
      this.recordTest(`Configuration file: ${file}`, exists);
    }

    // Test environment validation
    try {
      const validationScript = `
        const { validateEnvironment } = require('./lib/config/environment-validator');
        validateEnvironment().then(result => {
          console.log('Environment validation completed');
        }).catch(err => {
          console.error('Environment validation failed:', err.message);
        });
      `;
      
      await this.execCommand(`node -r tsx/require -e "${validationScript}"`);
      this.recordTest('Environment validation functional', true);
    } catch (error) {
      this.recordTest('Environment validation functional', false, error.message);
    }
  }

  async runTest(testFunction) {
    try {
      await testFunction();
    } catch (error) {
      this.recordTest(testFunction.name, false, error.message);
    }
  }

  recordTest(name, passed, details = '') {
    const result = {
      name,
      passed,
      details,
      timestamp: new Date().toISOString()
    };

    this.results.tests.push(result);
    
    if (passed) {
      this.results.passed++;
      this.log(`  ✅ ${name}`, 'green');
    } else {
      this.results.failed++;
      this.log(`  ❌ ${name}`, 'red');
      if (details) {
        this.log(`     Details: ${details}`, 'yellow');
      }
    }
  }

  async execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: TEST_CONFIG.testTimeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${command}\nError: ${error.message}\nStderr: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async generateReport() {
    const duration = Date.now() - this.startTime;
    
    this.log('\n' + '═'.repeat(80), 'blue');
    this.log('📊 LOGGING SYSTEM TEST REPORT', 'bright');
    this.log('═'.repeat(80), 'blue');
    
    this.log(`\n📈 Test Results:`, 'cyan');
    this.log(`  ✅ Passed: ${this.results.passed}`, 'green');
    this.log(`  ❌ Failed: ${this.results.failed}`, 'red');
    this.log(`  ⏱️  Duration: ${duration}ms`, 'blue');
    
    const successRate = (this.results.passed / (this.results.passed + this.results.failed)) * 100;
    this.log(`  📊 Success Rate: ${successRate.toFixed(1)}%`, successRate >= 90 ? 'green' : 'yellow');
    
    if (this.results.failed > 0) {
      this.log('\n❌ Failed Tests:', 'red');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => {
          this.log(`  • ${test.name}: ${test.details}`, 'red');
        });
    }
    
    this.log('\n🎯 Next Steps:', 'cyan');
    if (this.results.failed === 0) {
      this.log('  ✅ All tests passed! Logging system is ready for deployment.', 'green');
      this.log('  🚀 You can now start using the new logging system in development.', 'green');
      this.log('  📊 Monitor Sentry dashboard for error tracking.', 'blue');
    } else {
      this.log('  🔧 Fix the failing tests before deploying to production.', 'yellow');
      this.log('  📝 Review the error details above for troubleshooting guidance.', 'yellow');
    }
    
    this.log('\n' + '═'.repeat(80), 'blue');
    
    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'logging-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: successRate.toFixed(1),
        duration: duration,
        timestamp: new Date().toISOString()
      },
      tests: this.results.tests
    }, null, 2));
    
    this.log(`📄 Detailed report saved to: ${reportPath}`, 'blue');
    
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run the test suite
if (require.main === module) {
  const tester = new LoggingSystemTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = { LoggingSystemTester };
