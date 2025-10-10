import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'logs', 'instagram-us-reels');

export function writeSnapshot(label: string, data: unknown): void {
  if (!shouldLogSnapshots()) return;
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(ROOT, label);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.warn('[snapshot] failed', error);
  }
}

function shouldLogSnapshots(): boolean {
  return process.env.US_REELS_SNAPSHOT_LOGS === 'true';
}
