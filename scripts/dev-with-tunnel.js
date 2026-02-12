const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Load env vars from .env.local if present
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    const match = content.match(/^LOCAL_PORT=(.*)$/m);
    if (match) {
        process.env.LOCAL_PORT = match[1].trim();
    }
}

// Configuration
const LOCAL_PORT = process.env.LOCAL_PORT || process.env.PORT || 3000;
const ENV_VAR_NAME = 'NEXT_PUBLIC_SITE_URL';
const CLOUDFLARED_METRICS_PORT = 8181; // Default metrics port for cloudflared

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n${colors.bright}[${step}]${colors.reset} ${message}`);
}

/**
 * Updates the .env files with the new public URL
 */
function updateEnvFiles(url) {
    logStep('ENV', `Updating environment variables with URL: ${url}`);

    const rootDir = path.resolve(__dirname, '..');
    const envFiles = ['.env.local', '.env.development'];
    let updated = false;

    envFiles.forEach(file => {
        const filePath = path.join(rootDir, file);

        if (!fs.existsSync(filePath)) {
            // Create file if it doesn't exist
            fs.writeFileSync(filePath, `${ENV_VAR_NAME}=${url}\n`);
            log(`  ${colors.green}✓ Created ${file}${colors.reset}`);
            updated = true;
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        const envVarRegex = new RegExp(`^${ENV_VAR_NAME}=.*$`, 'm');

        if (envVarRegex.test(content)) {
            const currentMatch = content.match(envVarRegex);
            if (currentMatch && currentMatch[0].includes(url)) {
                log(`  ${file}: Already up to date`, colors.cyan);
            } else {
                content = content.replace(envVarRegex, `${ENV_VAR_NAME}=${url}`);
                fs.writeFileSync(filePath, content, 'utf8');
                log(`  ${colors.green}✓ Updated ${file}${colors.reset}`);
                updated = true;
            }
        } else {
            content += `\n${ENV_VAR_NAME}=${url}\n`;
            fs.writeFileSync(filePath, content, 'utf8');
            log(`  ${colors.green}✓ Updated ${file}${colors.reset}`);
            updated = true;
        }
    });

    return updated;
}

/**
 * Starts the cloudflared tunnel and returns a promise that resolves with the public URL
 */
async function startTunnel() {
    logStep('TUNNEL', `Starting Cloudflare Tunnel for port ${LOCAL_PORT}...`);

    return new Promise((resolve, reject) => {
        const tunnel = spawn('cloudflared', [
            'tunnel',
            '--url', `http://localhost:${LOCAL_PORT}`,
            '--metrics', `localhost:${CLOUDFLARED_METRICS_PORT}`
        ]);

        let urlFound = false;

        tunnel.stderr.on('data', (data) => {
            const output = data.toString();
            // Look for the URL in the output
            // Pattern: https://<random-subdomain>.trycloudflare.com
            const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

            if (match && !urlFound) {
                urlFound = true;
                const url = match[0];
                log(`${colors.green}✓ Tunnel established: ${url}${colors.reset}`);
                resolve({ process: tunnel, url });
            }
        });

        tunnel.on('error', (err) => {
            reject(new Error(`Failed to start cloudflared: ${err.message}`));
        });

        tunnel.on('exit', (code) => {
            if (!urlFound) {
                reject(new Error(`cloudflared exited with code ${code} before establishing tunnel`));
            }
        });
    });
}

/**
 * Starts the Next.js development server
 */
function startDevServer() {
    logStep('DEV SERVER', 'Starting Next.js development server...');

    const devProcess = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, PORT: String(LOCAL_PORT) }
    });

    return devProcess;
}

async function main() {
    log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log(`${colors.bright}${colors.blue}  🚀 Starting Dev Environment with Cloudflare Tunnel  ${colors.reset}`);
    log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    let tunnelProcess;
    let devProcess;

    try {
        // 1. Start Tunnel
        const tunnelInfo = await startTunnel();
        tunnelProcess = tunnelInfo.process;
        const publicUrl = tunnelInfo.url;

        // 2. Update Env Files
        updateEnvFiles(publicUrl);

        // 3. Start Dev Server
        log('\n');
        devProcess = startDevServer();

        // Handle cleanup
        const cleanup = () => {
            log('\n\nShutting down...', colors.yellow);

            if (tunnelProcess) {
                tunnelProcess.kill();
                log('✓ Tunnel stopped');
            }

            if (devProcess) {
                devProcess.kill();
                log('✓ Dev server stopped');
            }

            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);

    } catch (error) {
        log(`\n${colors.red}✗ Error: ${error.message}${colors.reset}`, colors.red);
        if (tunnelProcess) tunnelProcess.kill();
        if (devProcess) devProcess.kill();
        process.exit(1);
    }
}

main();
