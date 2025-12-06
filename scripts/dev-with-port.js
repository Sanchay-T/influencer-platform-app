// Dev launcher that reads .env.local and optional .env.worktree to set port
// Usage:
//   - npm run dev              -> uses LOCAL_PORT/PORT from env files or 3000
//   - LOCAL_PORT=3001 npm run dev
//   - Create .env.worktree with LOCAL_PORT to keep per-worktree port

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadEnv(file) {
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) {
    const result = dotenv.config({ path: full });
    if (result.error) {
      // ignore load errors, keep going
    }
  }
}

// Load base env, then override with per-worktree env if present
loadEnv('.env.local');
loadEnv('.env.worktree');

const port = process.env.LOCAL_PORT || process.env.PORT || '3000';

// Resolve local next binary reliably
let nextBin;
try {
  nextBin = require.resolve('next/dist/bin/next');
} catch (e) {
  console.error('Could not resolve Next.js binary. Did you run npm install?');
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, 'dev', '--turbo', '-p', String(port)], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port) },
});

child.on('exit', (code) => process.exit(code ?? 0));

