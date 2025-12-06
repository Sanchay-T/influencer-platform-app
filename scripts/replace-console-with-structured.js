#!/usr/bin/env node

/**
 * One-time migration script that replaces direct `console.*` usage with
 * the centralized `structuredConsole` proxy across app/lib/components.
 *
 * This keeps behaviour identical while satisfying the new eslint guard.
 */

const fs = require('fs/promises');
const path = require('path');

const TARGET_DIRS = ['app', 'lib', 'components'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IMPORT_STATEMENT = `import { structuredConsole } from '@/lib/logging/console-proxy';`;
const METHOD_MAP = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  'dir',
  'table',
  'group',
  'groupCollapsed',
  'groupEnd',
  'time',
  'timeEnd',
];

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

function ensureImport(content) {
  if (content.includes("@/lib/logging/console-proxy")) {
    return content;
  }

  const lines = content.split('\n');
  const useClientIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed === "'use client';" || trimmed === '"use client";';
  });

  if (useClientIndex !== -1) {
    lines.splice(useClientIndex + 1, 0, '', IMPORT_STATEMENT);
    return lines.join('\n');
  }

  return `${IMPORT_STATEMENT}\n${content}`;
}

function replaceConsole(content) {
  let next = content;

  for (const method of METHOD_MAP) {
    const regex = new RegExp(`\\bconsole\\.${method}\\b`, 'g');
    next = next.replace(regex, `structuredConsole.${method}`);
  }

  next = next.replace(/console\?\./g, 'structuredConsole?.');

  return next;
}

async function processFile(file) {
  const original = await fs.readFile(file, 'utf8');

  if (!original.includes('console.')) {
    return false;
  }

  let updated = replaceConsole(original);

  if (updated === original) {
    return false;
  }

  updated = ensureImport(updated);

  if (updated !== original) {
    await fs.writeFile(file, updated, 'utf8');
    return true;
  }

  return false;
}

async function main() {
  const root = process.cwd();
  let changedCount = 0;

  for (const dir of TARGET_DIRS) {
    const targetDir = path.join(root, dir);
    if (!(await fileExists(targetDir))) {
      continue;
    }

    const files = await collectFiles(targetDir);

    for (const file of files) {
      const changed = await processFile(file);
      if (changed) {
        changedCount += 1;
      }
    }
  }

  console.log(`Updated ${changedCount} files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
