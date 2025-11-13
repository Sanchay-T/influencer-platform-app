#!/usr/bin/env node

/**
 * Development server with automatic ngrok tunnel setup
 *
 * This script:
 * 1. Checks if ngrok is already running on port 3001
 * 2. If not, starts ngrok and waits for tunnel to be ready
 * 3. Updates .env.local and .env.development with the ngrok URL
 * 4. Starts the Next.js dev server
 * 5. Handles cleanup on exit (keeps ngrok running by default)
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const NGROK_API_URL = 'http://localhost:4040/api/tunnels';
const TARGET_PORT = 3001;
const ENV_VAR_NAME = 'NEXT_PUBLIC_SITE_URL';
const POLL_INTERVAL = 500; // ms
const MAX_POLL_ATTEMPTS = 40; // 20 seconds total

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${colors.bright}[${step}]${colors.reset} ${message}`);
}

async function checkNgrokStatus() {
  return new Promise((resolve) => {
    http.get(NGROK_API_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tunnels = JSON.parse(data).tunnels || [];
          const tunnel = tunnels.find(t =>
            t.config && t.config.addr && t.config.addr.includes(`:${TARGET_PORT}`)
          );

          if (tunnel && tunnel.public_url) {
            // Prefer HTTPS URL
            const httpsUrl = tunnel.public_url.startsWith('https')
              ? tunnel.public_url
              : tunnels.find(t => t.public_url.startsWith('https'))?.public_url || tunnel.public_url;

            resolve({ running: true, url: httpsUrl });
          } else {
            resolve({ running: false });
          }
        } catch (error) {
          resolve({ running: false });
        }
      });
    }).on('error', () => {
      resolve({ running: false });
    });
  });
}

async function startNgrok() {
  logStep('NGROK', `Starting ngrok on port ${TARGET_PORT}...`);

  const ngrokProcess = spawn('ngrok', ['http', TARGET_PORT.toString()], {
    detached: true,
    stdio: 'ignore'
  });

  ngrokProcess.unref(); // Allow parent to exit independently

  // Wait for ngrok to start and get the URL
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    const status = await checkNgrokStatus();
    if (status.running) {
      log(`${colors.green}✓ Ngrok tunnel established: ${status.url}${colors.reset}`);
      return status.url;
    }

    if (attempt % 4 === 0) {
      log(`  Waiting for ngrok to start... (${Math.floor(attempt * POLL_INTERVAL / 1000)}s)`, colors.cyan);
    }
  }

  throw new Error('Ngrok failed to start within timeout period');
}

function updateEnvFile(filePath, url) {
  if (!fs.existsSync(filePath)) {
    log(`  ⚠ ${filePath} not found, skipping`, colors.yellow);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const envVarRegex = new RegExp(`^${ENV_VAR_NAME}=.*$`, 'm');

  // Check if URL is already correct
  const currentMatch = content.match(envVarRegex);
  if (currentMatch && currentMatch[0].includes(url)) {
    log(`  ${path.basename(filePath)}: Already up to date`, colors.cyan);
    return false;
  }

  // Update or add the env variable
  if (envVarRegex.test(content)) {
    content = content.replace(envVarRegex, `${ENV_VAR_NAME}=${url}`);
  } else {
    // Add to file if not present
    content += `\n${ENV_VAR_NAME}=${url}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  log(`  ${colors.green}✓ Updated ${path.basename(filePath)}${colors.reset}`);
  return true;
}

function updateEnvFiles(url) {
  logStep('ENV', 'Updating environment files...');

  const rootDir = path.resolve(__dirname, '..');
  const envLocal = path.join(rootDir, '.env.local');
  const envDevelopment = path.join(rootDir, '.env.development');

  const localUpdated = updateEnvFile(envLocal, url);
  const devUpdated = updateEnvFile(envDevelopment, url);

  if (!localUpdated && !devUpdated) {
    log('  No updates needed', colors.cyan);
  }
}

function startDevServer() {
  logStep('DEV SERVER', 'Starting Next.js development server...');

  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n\nShutting down dev server...', colors.yellow);
    devProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    devProcess.kill('SIGTERM');
    process.exit(0);
  });

  devProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(`\nDev server exited with code ${code}`, colors.red);
    }
    process.exit(code || 0);
  });
}

async function main() {
  log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log(`${colors.bright}${colors.blue}  🚀 Starting Development Server with Ngrok  ${colors.reset}`);
  log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  try {
    // Step 1: Check if ngrok is already running
    logStep('CHECK', 'Checking ngrok status...');
    let status = await checkNgrokStatus();

    let ngrokUrl;
    if (status.running) {
      log(`${colors.green}✓ Ngrok is already running: ${status.url}${colors.reset}`);
      ngrokUrl = status.url;
    } else {
      log('  Ngrok not running, starting it now...', colors.cyan);
      ngrokUrl = await startNgrok();
    }

    // Step 2: Update env files
    updateEnvFiles(ngrokUrl);

    // Step 3: Start dev server
    log('\n'); // spacing
    startDevServer();

  } catch (error) {
    log(`\n${colors.red}✗ Error: ${error.message}${colors.reset}`, colors.red);
    log('\nTroubleshooting tips:', colors.yellow);
    log('  1. Make sure ngrok is installed and in your PATH');
    log('  2. Check if port 3001 is available');
    log('  3. Verify ngrok auth token is configured');
    process.exit(1);
  }
}

main();
