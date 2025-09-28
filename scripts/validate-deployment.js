#!/usr/bin/env node

/**
 * Deployment Validation Script for Phase 5
 * Comprehensive pre-deployment validation with enhanced logging system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ANSI color codes for better output
const colors = {
  reset: '[0m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  blue: '[34m',
  magenta: '[35m',
  cyan: '[36m',
  bold: '[1m'
};

// Configuration
const config = {
  environment: process.env.NODE_ENV || 'development',
  sentryEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  healthCheckUrl: process.env.NEXT_PUBLIC_SITE_URL 
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/health`
    : 'http://localhost:3000/api/health',
  validationUrl: process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/validate-deployment`
    : 'http://localhost:3000/api/validate-deployment',
  timeout: 30000, // 30 seconds
  retries: 3
};

/**
 * Logger with colors and timestamps
 */
class Logger {
  static info(message, data = null) {
    console.log(`${colors.blue}â¹${colors.reset} ${colors.bold}[INFO]${colors.reset} ${message}`);
    if (data) console.log(data);
  }
  
  static success(message, data = null) {
    console.log(`${colors.green}â${colors.reset} ${colors.bold}[SUCCESS]${colors.reset} ${message}`);
    if (data) console.log(data);
  }
  
  static warn(message, data = null) {
    console.log(`${colors.yellow}â ï¸${colors.reset} ${colors.bold}[WARNING]${colors.reset} ${message}`);
    if (data) console.log(data);
  }
  
  static error(message, data = null) {
    console.log(`${colors.red}â${colors.reset} ${colors.bold}[ERROR]${colors.reset} ${message}`);
    if (data) console.error(data);
  }
  
  static step(step, total, message) {
    console.log(`\n${colors.cyan}[${step}/${total}]${colors.reset} ${colors.bold}${message}${colors.reset}`);
  }
  
  static separator() {
    console.log(`${colors.blue}${'='.repeat(80)}${colors.reset}`);
  }
}

/**
 * Main deployment validation function
 */
async function validateDeployment() {
  Logger.separator();
  Logger.info('ð Starting Enhanced Deployment Validation (Phase 5)');
  Logger.info(`Environment: ${config.environment}`);
  Logger.info(`Sentry Environment: ${config.sentryEnvironment || 'Not set'}`);
  Logger.separator();
  
  const startTime = Date.now();
  let exitCode = 0;
  
  try {
    // Step 1: Environment Configuration Check
    Logger.step(1, 8, 'Validating Environment Configuration');
    await validateEnvironmentConfig();
    
    // Step 2: Build Validation
    Logger.step(2, 8, 'Validating Build Configuration');
    await validateBuildConfig();
    
    // Step 3: Security Configuration
    Logger.step(3, 8, 'Validating Security Configuration');
    await validateSecurityConfig();
    
    // Step 4: External Services
    Logger.step(4, 8, 'Validating External Services');
    await validateExternalServices();
    
    // Step 5: Database Connectivity
    Logger.step(5, 8, 'Testing Database Connectivity');
    await validateDatabaseConnection();
    
    // Step 6: Run Application Health Check
    Logger.step(6, 8, 'Running Application Health Check');
    await runHealthCheck();
    
    // Step 7: Comprehensive Deployment Validation
    Logger.step(7, 8, 'Running Comprehensive Deployment Validation');
    await runComprehensiveValidation();
    
    // Step 8: Generate Final Report
    Logger.step(8, 8, 'Generating Deployment Report');
    await generateDeploymentReport();
    
  } catch (error) {
    Logger.error('Deployment validation failed:', error.message);
    exitCode = 1;
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  Logger.separator();
  if (exitCode === 0) {
    Logger.success(`ð Deployment validation completed successfully in ${duration}s`);
    Logger.success('â System is ready for deployment');
  } else {
    Logger.error(`ð¥ Deployment validation failed in ${duration}s`);
    Logger.error('â System is NOT ready for deployment');
  }
  Logger.separator();
  
  process.exit(exitCode);
}

/**
 * Validate environment configuration
 */
async function validateEnvironmentConfig() {
  const requiredVars = getRequiredEnvironmentVariables();
  const missing = [];
  const warnings = [];
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    
    if (!value || value.trim() === '') {
      missing.push(varName);
    } else {
      // Check for placeholder values
      const placeholderValues = ['your_value_here', 'placeholder', 'TODO', 'CHANGEME'];
      if (placeholderValues.some(placeholder => 
          value.toLowerCase().includes(placeholder.toLowerCase()))) {
        warnings.push(`${varName} contains placeholder value`);
      }
    }
  }
  
  if (missing.length > 0) {
    Logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing ${missing.length} required environment variables`);
  }
  
  if (warnings.length > 0) {
    for (const warning of warnings) {
      Logger.warn(warning);
    }
  }
  
  // Check environment-specific settings
  if (config.environment === 'production') {
    validateProductionSpecificSettings();
  }
  
  Logger.success(`Environment configuration validated (${requiredVars.length} variables checked)`);
}

/**
 * Validate build configuration
 */
async function validateBuildConfig() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found');
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Check required dependencies
  const requiredDeps = ['@sentry/nextjs', 'next'];
  const missingDeps = requiredDeps.filter(dep => 
    !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]);
  
  if (missingDeps.length > 0) {
    throw new Error(`Missing required dependencies: ${missingDeps.join(', ')}`);
  }
  
  // Check Next.js configuration
  const nextConfigPath = path.join(process.cwd(), 'next.config.mjs');
  if (!fs.existsSync(nextConfigPath)) {
    throw new Error('next.config.mjs not found');
  }
  
  const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
  if (!nextConfig.includes('withSentryConfig')) {
    Logger.warn('Sentry configuration not found in next.config.mjs');
  }
  
  Logger.success('Build configuration validated');
}

/**
 * Validate security configuration
 */
async function validateSecurityConfig() {
  const issues = [];
  
  // Check HTTPS in production
  if (config.environment === 'production') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && !siteUrl.startsWith('https://')) {
      issues.push('Production site URL should use HTTPS');
    }
    
    // Check for development settings in production
    if (process.env.ENABLE_TEST_AUTH === 'true') {
      issues.push('Test authentication is enabled in production');
    }
    
    if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
      issues.push('Development mode is enabled in production');
    }
    
    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      issues.push('NODE_ENV should be "production" in production environment');
    }
  }
  
  // Check admin configuration
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  if (!adminEmails && config.environment !== 'test') {
    Logger.warn('Admin emails not configured');
  }
  
  // Check sensitive values
  const sensitiveVars = ['DATABASE_URL', 'CLERK_SECRET_KEY', 'STRIPE_SECRET_KEY'];
  for (const varName of sensitiveVars) {
    const value = process.env[varName];
    if (value && (value.includes('localhost') || value.includes('127.0.0.1')) && 
        config.environment === 'production') {
      issues.push(`${varName} contains localhost reference in production`);
    }
  }
  
  if (issues.length > 0) {
    for (const issue of issues) {
      Logger.error(issue);
    }
    throw new Error(`Found ${issues.length} security issues`);
  }
  
  Logger.success('Security configuration validated');
}

/**
 * Validate external services
 */
async function validateExternalServices() {
  const services = [
    { name: 'Sentry', check: () => !!process.env.NEXT_PUBLIC_SENTRY_DSN },
    { name: 'Database', check: () => !!process.env.DATABASE_URL },
    { name: 'Clerk', check: () => !!process.env.CLERK_SECRET_KEY },
    { name: 'Stripe', check: () => !!process.env.STRIPE_SECRET_KEY, required: config.environment === 'production' },
    { name: 'QStash', check: () => !!process.env.QSTASH_TOKEN },
    { name: 'Apify', check: () => !!process.env.APIFY_TOKEN },
    { name: 'Resend', check: () => !!process.env.RESEND_API_KEY, required: config.environment === 'production' },
    { name: 'Vercel Blob', check: () => !!process.env.BLOB_READ_WRITE_TOKEN }
  ];
  
  const results = services.map(service => ({
    name: service.name,
    configured: service.check(),
    required: service.required !== false
  }));
  
  const missingRequired = results.filter(r => r.required && !r.configured);
  const missingOptional = results.filter(r => !r.required && !r.configured);
  
  if (missingRequired.length > 0) {
    Logger.error(`Missing required services: ${missingRequired.map(r => r.name).join(', ')}`);
    throw new Error(`${missingRequired.length} required services not configured`);
  }
  
  if (missingOptional.length > 0) {
    Logger.warn(`Optional services not configured: ${missingOptional.map(r => r.name).join(', ')}`);
  }
  
  const configuredCount = results.filter(r => r.configured).length;
  Logger.success(`External services validated (${configuredCount}/${results.length} configured)`);
}

/**
 * Validate database connection
 */
async function validateDatabaseConnection() {
  try {
    // Try to run a simple database check script
    const testScript = `
      const { Client } = require('pg');

      (async () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          console.error('DATABASE_URL is not set');
          process.exit(1);
          return;
        }

        const sslRequired = /supabase\.co|\.pooler\./.test(connectionString);
        const client = new Client({
          connectionString,
          ssl: sslRequired ? { rejectUnauthorized: false } : undefined
        });

        try {
          await client.connect();
          await client.query('SELECT 1');
          console.log('Database connection successful');
          await client.end();
          process.exit(0);
        } catch (error) {
          console.error('Database connection failed:', error.message);
          process.exit(1);
        }
      })();
    `;

    const tempScript = path.join(process.cwd(), '.temp-db-test.js');
    fs.writeFileSync(tempScript, testScript);

    try {
      execSync(`node ${tempScript}`, { stdio: 'pipe', timeout: 10000 });
      Logger.success('Database connection validated');
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempScript)) {
        fs.unlinkSync(tempScript);
      }
    }

  } catch (error) {
    Logger.error('Database connection validation failed:', error.message);
    throw new Error('Database connection failed');
  }
}

/**
 * Run application health check
 */
async function runHealthCheck() {
  try {
    // First, try to build the application
    Logger.info('Building application...');
    try {
      execSync('npm run build', { stdio: 'pipe', timeout: 120000 });
      Logger.success('Application build successful');
    } catch (buildError) {
      Logger.error('Application build failed');
      throw new Error('Build failed');
    }
    
    // If we have a health check URL, test it
    if (config.healthCheckUrl.includes('localhost')) {
      Logger.warn('Skipping health check - localhost URL detected');
      return;
    }
    
    const healthResponse = await makeHttpRequest(config.healthCheckUrl, {
      method: 'GET',
      timeout: config.timeout
    });
    
    if (healthResponse.status === 'healthy' || healthResponse.status === 'degraded') {
      Logger.success(`Health check passed - Status: ${healthResponse.status}`);
      
      if (healthResponse.status === 'degraded') {
        Logger.warn('System status is degraded - check warnings');
        if (healthResponse.checks) {
          Object.entries(healthResponse.checks).forEach(([key, check]) => {
            if (check.status === 'warn' || check.status === 'fail') {
              Logger.warn(`${key}: ${check.message}`);
            }
          });
        }
      }
    } else {
      throw new Error(`Health check failed - Status: ${healthResponse.status}`);
    }
    
  } catch (error) {
    Logger.error('Health check failed:', error.message);
    throw error;
  }
}

/**
 * Run comprehensive deployment validation
 */
async function runComprehensiveValidation() {
  try {
    const validationResponse = await makeHttpRequest(config.validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'pre-deployment',
        environment: config.environment,
        includeReport: false,
        skipSlowChecks: false
      }),
      timeout: config.timeout
    });
    
    if (validationResponse.deploymentReady) {
      Logger.success('Comprehensive deployment validation passed');
      
      // Log summary
      const { summary } = validationResponse;
      Logger.info(`Validation Summary: ${summary.passed}/${summary.totalChecks} passed, ${summary.failed} failed, ${summary.warnings} warnings`);
      
      // Log warnings if any
      if (validationResponse.warnings && validationResponse.warnings.length > 0) {
        Logger.warn('Deployment warnings:');
        validationResponse.warnings.forEach(warning => {
          Logger.warn(`  â¢ ${warning}`);
        });
      }
    } else {
      Logger.error('Comprehensive deployment validation failed');
      
      if (validationResponse.criticalIssues) {
        Logger.error('Critical issues:');
        validationResponse.criticalIssues.forEach(issue => {
          Logger.error(`  â¢ ${issue}`);
        });
      }
      
      if (validationResponse.recommendations) {
        Logger.info('Recommendations:');
        validationResponse.recommendations.forEach(rec => {
          Logger.info(`  â¢ ${rec}`);
        });
      }
      
      throw new Error(`Deployment validation failed with ${validationResponse.criticalIssues?.length || 0} critical issues`);
    }
    
  } catch (error) {
    if (config.validationUrl.includes('localhost')) {
      Logger.warn('Skipping comprehensive validation - localhost URL detected');
      return;
    }
    
    Logger.error('Comprehensive validation failed:', error.message);
    throw error;
  }
}

/**
 * Generate deployment report
 */
async function generateDeploymentReport() {
  const reportPath = path.join(process.cwd(), 'deployment-validation-report.md');
  
  try {
    if (config.validationUrl.includes('localhost')) {
      Logger.warn('Skipping report generation - localhost URL detected');
      return;
    }
    
    const reportResponse = await makeHttpRequest(`${config.validationUrl}?format=report`, {
      method: 'GET',
      timeout: config.timeout
    });
    
    if (typeof reportResponse === 'string') {
      fs.writeFileSync(reportPath, reportResponse);
      Logger.success(`Deployment report generated: ${reportPath}`);
    } else {
      Logger.warn('Report generation skipped - invalid response format');
    }
    
  } catch (error) {
    Logger.warn('Report generation failed:', error.message);
    // Don't fail the entire validation for report generation issues
  }
}

/**
 * Helper functions
 */

function getRequiredEnvironmentVariables() {
  const baseVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  if (config.environment === 'production') {
    return [
      ...baseVars,
      'NEXT_PUBLIC_SENTRY_DSN',
      'SENTRY_AUTH_TOKEN',
      'CLERK_SECRET_KEY',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'QSTASH_TOKEN',
      'APIFY_TOKEN',
      'RESEND_API_KEY',
      'BLOB_READ_WRITE_TOKEN'
    ];
  }
  
  if (config.environment === 'development') {
    return [
      ...baseVars,
      'ENABLE_TEST_AUTH',
      'TEST_USER_ID'
    ];
  }
  
  return baseVars;
}

function validateProductionSpecificSettings() {
  const issues = [];
  
  // Check Sentry sampling rates
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0');
  if (tracesSampleRate > 0.5) {
    Logger.warn(`High Sentry traces sample rate in production: ${tracesSampleRate}`);
  }
  
  // Check for proper URL schemes
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && !siteUrl.startsWith('https://')) {
    issues.push('Production site URL should use HTTPS');
  }
  
  // Check database pooling
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes('pooler.supabase.com')) {
    Logger.warn('Database URL may not be using connection pooling');
  }
  
  if (issues.length > 0) {
    throw new Error(`Production validation issues: ${issues.join(', ')}`);
  }
}

async function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 10000;
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body;
    
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'User-Agent': 'deployment-validator/1.0',
        ...headers
      },
      timeout
    };
    
    if (body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    
    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.headers['content-type']?.includes('application/json')) {
            resolve(JSON.parse(data));
          } else {
            resolve(data);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--environment' || arg === '-e') {
      options.environment = args[++i];
    } else if (arg === '--health-url') {
      options.healthUrl = args[++i];
    } else if (arg === '--validation-url') {
      options.validationUrl = args[++i];
    } else if (arg === '--timeout') {
      options.timeout = parseInt(args[++i], 10) * 1000; // Convert to ms
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Deployment Validation Script

Usage: node scripts/validate-deployment.js [options]

Options:
  -e, --environment <env>    Target environment (development, staging, production)
  --health-url <url>         Health check endpoint URL
  --validation-url <url>     Validation endpoint URL
  --timeout <seconds>        Request timeout in seconds (default: 30)
  -h, --help                Show this help message

Examples:
  node scripts/validate-deployment.js --environment production
  node scripts/validate-deployment.js --health-url https://yourdomain.com/api/health
      `);
      process.exit(0);
    }
  }
  
  return options;
}

/**
 * Main execution
 */
if (require.main === module) {
  const options = parseArgs();
  
  // Override config with command line options
  if (options.environment) config.environment = options.environment;
  if (options.healthUrl) config.healthCheckUrl = options.healthUrl;
  if (options.validationUrl) config.validationUrl = options.validationUrl;
  if (options.timeout) config.timeout = options.timeout;
  
  validateDeployment();
}

module.exports = {
  validateDeployment,
  Logger,
  config
};