#!/usr/bin/env node

/**
 * Ensures that the `'use client'` directive appears at the top of files,
 * before any import statements.
 */

const fs = require('fs/promises');
const path = require('path');

const TARGET_DIRS = ['app', 'components', 'lib'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

async function fileExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectFiles(fullPath);
      results.push(...nested);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!FILE_EXTENSIONS.has(ext)) continue;
    results.push(fullPath);
  }

  return results;
}

function normalizeDirective(line) {
  const trimmed = line.trim();
  if (trimmed === "'use client'" || trimmed === '"use client"' || trimmed === "'use client';" || trimmed === '"use client";') {
    return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
  }
  return null;
}

async function processFile(file) {
  const original = await fs.readFile(file, 'utf8');

  if (!original.includes('use client')) {
    return false;
  }

  const lines = original.split('\n');

  let directiveLineIndex = lines.findIndex((line) => normalizeDirective(line) !== null);
  if (directiveLineIndex === -1) {
    return false;
  }

  const normalizedDirective = normalizeDirective(lines[directiveLineIndex]);

  let firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstNonEmptyIndex === directiveLineIndex) {
    // already at top
    if (lines[firstNonEmptyIndex] !== normalizedDirective) {
      lines[firstNonEmptyIndex] = normalizedDirective;
      await fs.writeFile(file, lines.join('\n'), 'utf8');
      return true;
    }
    return false;
  }

  // remove directive from current location
  lines.splice(directiveLineIndex, 1);

  // insert at top (before any imports). We'll place as first non-empty line
  const insertIndex = firstNonEmptyIndex === -1 ? 0 : firstNonEmptyIndex;
  lines.splice(insertIndex, 0, normalizedDirective, '');

  await fs.writeFile(file, lines.join('\n'), 'utf8');
  return true;
}

async function main() {
  const root = process.cwd();
  let changed = 0;

  for (const dir of TARGET_DIRS) {
    const targetDir = path.join(root, dir);
    if (!(await fileExists(targetDir))) {
      continue;
    }
    const files = await collectFiles(targetDir);
    for (const file of files) {
      const updated = await processFile(file);
      if (updated) changed += 1;
    }
  }

  console.log(`Fixed directive order in ${changed} files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
