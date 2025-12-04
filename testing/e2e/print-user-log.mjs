#!/usr/bin/env node
// Print per-user onboarding log (JSONL) from logs/users/<hash>/all_activity.jsonl
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const email = process.argv[2];
if (!email) {
  console.error('Usage: ./testing/e2e/print-user-log.mjs <email>');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
const file = path.join(process.cwd(), 'logs', 'users', hash, 'all_activity.jsonl');

if (!fs.existsSync(file)) {
  console.error('No log file found for', email, `(hash ${hash.slice(0,8)}…)`);
  process.exit(1);
}

const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
console.log(`Logs for ${email} (hash ${hash})`);
for (const line of lines) {
  const entry = JSON.parse(line);
  console.log(`${entry.timestamp} [${entry.event}] ${entry.message}`);
  if (entry.data) console.log('  data:', JSON.stringify(entry.data));
}
