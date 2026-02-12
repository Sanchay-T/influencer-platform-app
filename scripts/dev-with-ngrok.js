#!/usr/bin/env node

/**
 * Development server with permanent ngrok tunnel
 *
 * Uses permanent domain: usegemz.ngrok.app (paid ngrok plan)
 *
 * This script:
 * 1. Resolves the local dev port (LOCAL_PORT/PORT, supports .env.local/.env.worktree)
 * 2. Checks if ngrok is already running for that port
 * 2. If not, starts ngrok with the permanent domain
 * 3. Starts the Next.js dev server
 *
 * Run: npm run dev:ngrok
 */

const http = require('http');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const NGROK_API_URL = 'http://localhost:4040/api/tunnels';
const POLL_INTERVAL = 500; // ms
const MAX_POLL_ATTEMPTS = 40; // 20 seconds total

// Permanent ngrok domain (paid plan) - no env file updates needed
const NGROK_DOMAIN = 'usegemz.ngrok.app';
const NGROK_URL = `https://${NGROK_DOMAIN}`;

function loadEnv(file) {
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full });
  }
}

loadEnv('.env.local');
loadEnv('.env.worktree');

// Default to 3001 for this repo (matches current dev convention), but allow overrides
const TARGET_PORT = Number(process.env.LOCAL_PORT || process.env.PORT || '3001');

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

function getPidsOnPort(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();

    if (!output) {
      return [];
    }

    return output
      .split('\n')
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isFinite(pid));
  } catch {
    return [];
  }
}

function cleanupPort(port) {
  const initialPids = getPidsOnPort(port);
  if (!initialPids.length) {
    return;
  }

  logStep('PORT', `Cleaning up ${initialPids.length} process(es) on port ${port}...`);

  for (const pid of initialPids) {
    try {
      process.kill(pid, 'SIGTERM');
      log(`  Sent SIGTERM to PID ${pid}`, colors.cyan);
    } catch {
      // Ignore PID races.
    }
  }

  // Give processes a moment to exit gracefully.
  const waitUntil = Date.now() + 1200;
  while (Date.now() < waitUntil) {
    const remaining = getPidsOnPort(port);
    if (!remaining.length) {
      log(`${colors.green}✓ Port ${port} is now free${colors.reset}`);
      return;
    }
  }

  const forcePids = getPidsOnPort(port);
  for (const pid of forcePids) {
    try {
      process.kill(pid, 'SIGKILL');
      log(`  Force-killed PID ${pid}`, colors.yellow);
    } catch {
      // Ignore PID races.
    }
  }
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
          resolve({ running: !!tunnel, url: tunnel?.public_url });
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
  logStep('NGROK', `Starting ngrok with permanent domain: ${NGROK_DOMAIN} → localhost:${TARGET_PORT}...`);

  const ngrokProcess = spawn('ngrok', ['http', `--url=${NGROK_DOMAIN}`, TARGET_PORT.toString()], {
    detached: true,
    stdio: 'ignore'
  });

  ngrokProcess.unref(); // Allow parent to exit independently

  // Wait for ngrok to start
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    const status = await checkNgrokStatus();
    if (status.running) {
      log(`${colors.green}✓ Ngrok tunnel established: ${NGROK_URL}${colors.reset}`);
      return NGROK_URL;
    }

    if (attempt % 4 === 0) {
      log(`  Waiting for ngrok to start... (${Math.floor(attempt * POLL_INTERVAL / 1000)}s)`, colors.cyan);
    }
  }

  throw new Error('Ngrok failed to start within timeout period');
}

function startDevServer() {
  logStep('DEV SERVER', `Starting Next.js development server on port ${TARGET_PORT}...`);

  const useTurbo = process.env.NO_TURBO !== 'true'; // Enable Turbopack by default for faster compilation

  // Resolve local Next.js binary reliably (avoid relying on npm script indirection)
  let nextBin;
  try {
    nextBin = require.resolve('next/dist/bin/next');
  } catch (e) {
    log('Could not resolve Next.js binary. Did you run npm install?', colors.red);
    process.exit(1);
  }

  const args = [nextBin, 'dev', '-p', String(TARGET_PORT)];
  if (useTurbo) {
    args.push('--turbopack');
    log('Using Turbopack for faster compilation', colors.cyan);
  }

  const devProcess = spawn(process.execPath, args, {
    stdio: 'inherit',
    // Ensure Next.js binds to the same port ngrok is forwarding to
    env: { ...process.env, LOCAL_PORT: String(TARGET_PORT), PORT: String(TARGET_PORT) },
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
  log(`${colors.bright}${colors.blue}  🚀 Dev Server + Ngrok (${NGROK_DOMAIN})  ${colors.reset}`);
  log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  try {
    cleanupPort(TARGET_PORT);

    // Step 1: Check if ngrok is already running
    logStep('CHECK', 'Checking ngrok status...');
    const status = await checkNgrokStatus();

    if (status.running) {
      log(`${colors.green}✓ Ngrok already running: ${NGROK_URL}${colors.reset}`);
    } else {
      log('  Ngrok not running, starting it now...', colors.cyan);
      await startNgrok();
    }

    // Step 2: Start dev server
    log('\n');
    startDevServer();

  } catch (error) {
    log(`\n${colors.red}✗ Error: ${error.message}${colors.reset}`, colors.red);
    log('\nTroubleshooting tips:', colors.yellow);
    log('  1. Make sure ngrok is installed and in your PATH');
    log(`  2. Check if port ${TARGET_PORT} is available`);
    log('  3. Verify ngrok auth token is configured');
    log('  4. Run: ngrok config add-authtoken <your-token>');
    process.exit(1);
  }
}

main();
