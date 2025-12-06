#!/usr/bin/env node
// Lints migration files for duplicate prefixes and basic ordering issues without touching the DB.
// Exits non-zero on problems.

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migration dir not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .filter(f => !f.startsWith('legacy/'));
  const issues = [];

  const byPrefix = new Map();
  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;
    const prefix = match[1];
    const arr = byPrefix.get(prefix) || [];
    arr.push(file);
    byPrefix.set(prefix, arr);
  }

  for (const [prefix, names] of byPrefix.entries()) {
    if (names.length > 1) {
      issues.push(`Duplicate prefix ${prefix}: ${names.join(', ')}`);
    }
  }

  const sorted = files.slice().sort();
  const uniqueSorted = Array.from(new Set(sorted));
  if (sorted.length !== uniqueSorted.length) {
    issues.push('Duplicate filenames detected (case-sensitive check failed).');
  }

  if (issues.length) {
    console.error('Migration lint failed:');
    issues.forEach(i => console.error(`- ${i}`));
    process.exit(1);
  }

  console.log(`✔ Migrations look ok (${files.length} files checked).`);
}

main();
