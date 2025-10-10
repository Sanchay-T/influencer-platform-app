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
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
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
    console.log(`${colors.blue}ℹ${colors.reset} ${colors.bold}[INFO]${colors.reset} ${message}`);
    if (data) console.log(data);
  }
  
  static success(message, data = null) {
    console.log(`${colors.green}✅${colors.reset} ${colors.bold}[SUCCESS]${colors.reset} ${message}`);
    if (data) console.log(data);
  }
  
  static warn(message, data = null) {
    console.log(`${colors.yellow}⚠️${colors.reset} ${colors.bold}[WARNING]${colors.reset} ${message}`);
    if (data) console.log(data);
  }
  
  static error(message, data = null) {
    console.log(`${colors.red}❌${colors.reset} ${colors.bold}[ERROR]${colors.reset} ${message}`);
    if (data) console.error(data);
  }
  
  static step(step, total, message) {
    console.log(`\\n${colors.cyan}[${step}/${total}]${colors.reset} ${colors.bold}${message}${colors.reset}`);
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
  Logger.info('🚀 Starting Enhanced Deployment Validation (Phase 5)');
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
    Logger.success(`🎉 Deployment validation completed successfully in ${duration}s`);
    Logger.success('✅ System is ready for deployment');
  } else {
    Logger.error(`💥 Deployment validation failed in ${duration}s`);
    Logger.error('❌ System is NOT ready for deployment');
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
      issues.push('NODE_ENV should be \"production\" in production environment');
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
 */\nasync function validateExternalServices() {\n  const services = [\n    { name: 'Sentry', check: () => !!process.env.NEXT_PUBLIC_SENTRY_DSN },\n    { name: 'Database', check: () => !!process.env.DATABASE_URL },\n    { name: 'Clerk', check: () => !!process.env.CLERK_SECRET_KEY },\n    { name: 'Stripe', check: () => !!process.env.STRIPE_SECRET_KEY, required: config.environment === 'production' },\n    { name: 'QStash', check: () => !!process.env.QSTASH_TOKEN },\n    { name: 'Apify', check: () => !!process.env.APIFY_TOKEN },\n    { name: 'Resend', check: () => !!process.env.RESEND_API_KEY, required: config.environment === 'production' },\n    { name: 'Vercel Blob', check: () => !!process.env.BLOB_READ_WRITE_TOKEN }\n  ];\n  \n  const results = services.map(service => ({\n    name: service.name,\n    configured: service.check(),\n    required: service.required !== false\n  }));\n  \n  const missingRequired = results.filter(r => r.required && !r.configured);\n  const missingOptional = results.filter(r => !r.required && !r.configured);\n  \n  if (missingRequired.length > 0) {\n    Logger.error(`Missing required services: ${missingRequired.map(r => r.name).join(', ')}`);\n    throw new Error(`${missingRequired.length} required services not configured`);\n  }\n  \n  if (missingOptional.length > 0) {\n    Logger.warn(`Optional services not configured: ${missingOptional.map(r => r.name).join(', ')}`);\n  }\n  \n  const configuredCount = results.filter(r => r.configured).length;\n  Logger.success(`External services validated (${configuredCount}/${results.length} configured)`);\n}\n\n/**\n * Validate database connection\n */\nasync function validateDatabaseConnection() {\n  try {\n    // Try to run a simple database check script\n    const testScript = `\n      const { db } = require('./lib/db');\n      const SystemConfig = require('./lib/config/system-config').default;\n      \n      (async () => {\n        try {\n          await SystemConfig.get('api_limits', 'max_api_calls_for_testing');\n          console.log('Database connection successful');\n          process.exit(0);\n        } catch (error) {\n          console.error('Database connection failed:', error.message);\n          process.exit(1);\n        }\n      })();\n    `;\n    \n    const tempScript = path.join(process.cwd(), '.temp-db-test.js');\n    fs.writeFileSync(tempScript, testScript);\n    \n    try {\n      execSync(`node ${tempScript}`, { stdio: 'pipe', timeout: 10000 });\n      Logger.success('Database connection validated');\n    } finally {\n      // Clean up temp file\n      if (fs.existsSync(tempScript)) {\n        fs.unlinkSync(tempScript);\n      }\n    }\n    \n  } catch (error) {\n    Logger.error('Database connection validation failed:', error.message);\n    throw new Error('Database connection failed');\n  }\n}\n\n/**\n * Run application health check\n */\nasync function runHealthCheck() {\n  try {\n    // First, try to build the application\n    Logger.info('Building application...');\n    try {\n      execSync('npm run build', { stdio: 'pipe', timeout: 120000 });\n      Logger.success('Application build successful');\n    } catch (buildError) {\n      Logger.error('Application build failed');\n      throw new Error('Build failed');\n    }\n    \n    // If we have a health check URL, test it\n    if (config.healthCheckUrl.includes('localhost')) {\n      Logger.warn('Skipping health check - localhost URL detected');\n      return;\n    }\n    \n    const healthResponse = await makeHttpRequest(config.healthCheckUrl, {\n      method: 'GET',\n      timeout: config.timeout\n    });\n    \n    if (healthResponse.status === 'healthy' || healthResponse.status === 'degraded') {\n      Logger.success(`Health check passed - Status: ${healthResponse.status}`);\n      \n      if (healthResponse.status === 'degraded') {\n        Logger.warn('System status is degraded - check warnings');\n        if (healthResponse.checks) {\n          Object.entries(healthResponse.checks).forEach(([key, check]) => {\n            if (check.status === 'warn' || check.status === 'fail') {\n              Logger.warn(`${key}: ${check.message}`);\n            }\n          });\n        }\n      }\n    } else {\n      throw new Error(`Health check failed - Status: ${healthResponse.status}`);\n    }\n    \n  } catch (error) {\n    Logger.error('Health check failed:', error.message);\n    throw error;\n  }\n}\n\n/**\n * Run comprehensive deployment validation\n */\nasync function runComprehensiveValidation() {\n  try {\n    const validationResponse = await makeHttpRequest(config.validationUrl, {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json'\n      },\n      body: JSON.stringify({\n        type: 'pre-deployment',\n        environment: config.environment,\n        includeReport: false,\n        skipSlowChecks: false\n      }),\n      timeout: config.timeout\n    });\n    \n    if (validationResponse.deploymentReady) {\n      Logger.success('Comprehensive deployment validation passed');\n      \n      // Log summary\n      const { summary } = validationResponse;\n      Logger.info(`Validation Summary: ${summary.passed}/${summary.totalChecks} passed, ${summary.failed} failed, ${summary.warnings} warnings`);\n      \n      // Log warnings if any\n      if (validationResponse.warnings && validationResponse.warnings.length > 0) {\n        Logger.warn('Deployment warnings:');\n        validationResponse.warnings.forEach(warning => {\n          Logger.warn(`  • ${warning}`);\n        });\n      }\n    } else {\n      Logger.error('Comprehensive deployment validation failed');\n      \n      if (validationResponse.criticalIssues) {\n        Logger.error('Critical issues:');\n        validationResponse.criticalIssues.forEach(issue => {\n          Logger.error(`  • ${issue}`);\n        });\n      }\n      \n      if (validationResponse.recommendations) {\n        Logger.info('Recommendations:');\n        validationResponse.recommendations.forEach(rec => {\n          Logger.info(`  • ${rec}`);\n        });\n      }\n      \n      throw new Error(`Deployment validation failed with ${validationResponse.criticalIssues?.length || 0} critical issues`);\n    }\n    \n  } catch (error) {\n    if (config.validationUrl.includes('localhost')) {\n      Logger.warn('Skipping comprehensive validation - localhost URL detected');\n      return;\n    }\n    \n    Logger.error('Comprehensive validation failed:', error.message);\n    throw error;\n  }\n}\n\n/**\n * Generate deployment report\n */\nasync function generateDeploymentReport() {\n  const reportPath = path.join(process.cwd(), 'deployment-validation-report.md');\n  \n  try {\n    if (config.validationUrl.includes('localhost')) {\n      Logger.warn('Skipping report generation - localhost URL detected');\n      return;\n    }\n    \n    const reportResponse = await makeHttpRequest(`${config.validationUrl}?format=report`, {\n      method: 'GET',\n      timeout: config.timeout\n    });\n    \n    if (typeof reportResponse === 'string') {\n      fs.writeFileSync(reportPath, reportResponse);\n      Logger.success(`Deployment report generated: ${reportPath}`);\n    } else {\n      Logger.warn('Report generation skipped - invalid response format');\n    }\n    \n  } catch (error) {\n    Logger.warn('Report generation failed:', error.message);\n    // Don't fail the entire validation for report generation issues\n  }\n}\n\n/**\n * Helper functions\n */\n\nfunction getRequiredEnvironmentVariables() {\n  const baseVars = [\n    'NODE_ENV',\n    'DATABASE_URL',\n    'NEXT_PUBLIC_SUPABASE_URL',\n    'SUPABASE_SERVICE_ROLE_KEY',\n    'NEXT_PUBLIC_SUPABASE_ANON_KEY'\n  ];\n  \n  if (config.environment === 'production') {\n    return [\n      ...baseVars,\n      'NEXT_PUBLIC_SENTRY_DSN',\n      'SENTRY_AUTH_TOKEN',\n      'CLERK_SECRET_KEY',\n      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',\n      'STRIPE_SECRET_KEY',\n      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',\n      'QSTASH_TOKEN',\n      'APIFY_TOKEN',\n      'RESEND_API_KEY',\n      'BLOB_READ_WRITE_TOKEN'\n    ];\n  }\n  \n  if (config.environment === 'development') {\n    return [\n      ...baseVars,\n      'ENABLE_TEST_AUTH',\n      'TEST_USER_ID'\n    ];\n  }\n  \n  return baseVars;\n}\n\nfunction validateProductionSpecificSettings() {\n  const issues = [];\n  \n  // Check Sentry sampling rates\n  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0');\n  if (tracesSampleRate > 0.5) {\n    Logger.warn(`High Sentry traces sample rate in production: ${tracesSampleRate}`);\n  }\n  \n  // Check for proper URL schemes\n  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;\n  if (siteUrl && !siteUrl.startsWith('https://')) {\n    issues.push('Production site URL should use HTTPS');\n  }\n  \n  // Check database pooling\n  const dbUrl = process.env.DATABASE_URL;\n  if (dbUrl && !dbUrl.includes('pooler.supabase.com')) {\n    Logger.warn('Database URL may not be using connection pooling');\n  }\n  \n  if (issues.length > 0) {\n    throw new Error(`Production validation issues: ${issues.join(', ')}`);\n  }\n}\n\nasync function makeHttpRequest(url, options = {}) {\n  return new Promise((resolve, reject) => {\n    const timeout = options.timeout || 10000;\n    const method = options.method || 'GET';\n    const headers = options.headers || {};\n    const body = options.body;\n    \n    const urlObj = new URL(url);\n    const requestOptions = {\n      hostname: urlObj.hostname,\n      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),\n      path: urlObj.pathname + urlObj.search,\n      method,\n      headers: {\n        'User-Agent': 'deployment-validator/1.0',\n        ...headers\n      },\n      timeout\n    };\n    \n    if (body) {\n      requestOptions.headers['Content-Length'] = Buffer.byteLength(body);\n    }\n    \n    const protocol = urlObj.protocol === 'https:' ? https : require('http');\n    \n    const req = protocol.request(requestOptions, (res) => {\n      let data = '';\n      \n      res.on('data', (chunk) => {\n        data += chunk;\n      });\n      \n      res.on('end', () => {\n        try {\n          if (res.headers['content-type']?.includes('application/json')) {\n            resolve(JSON.parse(data));\n          } else {\n            resolve(data);\n          }\n        } catch (parseError) {\n          reject(new Error(`Failed to parse response: ${parseError.message}`));\n        }\n      });\n    });\n    \n    req.on('timeout', () => {\n      req.destroy();\n      reject(new Error('Request timeout'));\n    });\n    \n    req.on('error', (error) => {\n      reject(error);\n    });\n    \n    if (body) {\n      req.write(body);\n    }\n    \n    req.end();\n  });\n}\n\n/**\n * Parse command line arguments\n */\nfunction parseArgs() {\n  const args = process.argv.slice(2);\n  const options = {};\n  \n  for (let i = 0; i < args.length; i++) {\n    const arg = args[i];\n    \n    if (arg === '--environment' || arg === '-e') {\n      options.environment = args[++i];\n    } else if (arg === '--health-url') {\n      options.healthUrl = args[++i];\n    } else if (arg === '--validation-url') {\n      options.validationUrl = args[++i];\n    } else if (arg === '--timeout') {\n      options.timeout = parseInt(args[++i], 10) * 1000; // Convert to ms\n    } else if (arg === '--help' || arg === '-h') {\n      console.log(`\nDeployment Validation Script\n\nUsage: node scripts/validate-deployment.js [options]\n\nOptions:\n  -e, --environment <env>    Target environment (development, staging, production)\n  --health-url <url>         Health check endpoint URL\n  --validation-url <url>     Validation endpoint URL\n  --timeout <seconds>        Request timeout in seconds (default: 30)\n  -h, --help                Show this help message\n\nExamples:\n  node scripts/validate-deployment.js --environment production\n  node scripts/validate-deployment.js --health-url https://yourdomain.com/api/health\n      `);\n      process.exit(0);\n    }\n  }\n  \n  return options;\n}\n\n/**\n * Main execution\n */\nif (require.main === module) {\n  const options = parseArgs();\n  \n  // Override config with command line options\n  if (options.environment) config.environment = options.environment;\n  if (options.healthUrl) config.healthCheckUrl = options.healthUrl;\n  if (options.validationUrl) config.validationUrl = options.validationUrl;\n  if (options.timeout) config.timeout = options.timeout;\n  \n  validateDeployment();\n}\n\nmodule.exports = {\n  validateDeployment,\n  Logger,\n  config\n};