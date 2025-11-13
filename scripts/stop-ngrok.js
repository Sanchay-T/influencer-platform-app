#!/usr/bin/env node

/**
 * Stop all running ngrok tunnels
 *
 * This script finds and kills all ngrok processes
 */

const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function findNgrokProcesses() {
  try {
    // Find ngrok processes (works on macOS and Linux)
    const result = execSync('pgrep -f ngrok', { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    // pgrep returns non-zero exit code when no processes found
    return [];
  }
}

function killProcesses(pids) {
  pids.forEach(pid => {
    try {
      execSync(`kill ${pid}`);
      log(`  ✓ Killed process ${pid}`, colors.green);
    } catch (error) {
      log(`  ✗ Failed to kill process ${pid}`, colors.red);
    }
  });
}

function main() {
  log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log(`${colors.bright}${colors.cyan}  🛑 Stopping Ngrok Tunnels  ${colors.reset}`);
  log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const pids = findNgrokProcesses();

  if (pids.length === 0) {
    log('  No ngrok processes found', colors.yellow);
    log('\n✓ Nothing to do\n', colors.green);
    return;
  }

  log(`Found ${pids.length} ngrok process(es):\n`, colors.cyan);
  killProcesses(pids);

  // Give processes a moment to terminate
  setTimeout(() => {
    const remainingPids = findNgrokProcesses();
    if (remainingPids.length > 0) {
      log('\n⚠ Some processes did not terminate, forcing...', colors.yellow);
      remainingPids.forEach(pid => {
        try {
          execSync(`kill -9 ${pid}`);
          log(`  ✓ Force killed process ${pid}`, colors.green);
        } catch (error) {
          log(`  ✗ Failed to force kill process ${pid}`, colors.red);
        }
      });
    }

    log('\n✓ Done!\n', colors.green);
  }, 1000);
}

main();
