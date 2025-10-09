import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
const API_KEY = process.env.INFLUENCERS_CLUB_API_KEY;
if (!API_KEY) {
  console.error('Missing INFLUENCERS_CLUB_API_KEY');
  process.exit(1);
}

const metaTargets = [
  { name: 'locations-instagram', url: 'https://api-dashboard.influencers.club/public/v1/discovery/classifier/locations/instagram' },
  { name: 'locations-tiktok', url: 'https://api-dashboard.influencers.club/public/v1/discovery/classifier/locations/tiktok' },
  { name: 'locations-youtube', url: 'https://api-dashboard.influencers.club/public/v1/discovery/classifier/locations/youtube' },
  { name: 'locations-twitter', url: 'https://api-dashboard.influencers.club/public/v1/discovery/classifier/locations/twitter' },
  { name: 'locations-twitch', url: 'https://api-dashboard.influencers.club/public/v1/discovery/classifier/locations/twitch' },
  { name: 'locations-onlyfans', url: 'https://api-dashboard.influencers.club/public/v1/discovery/classifier/locations/onlyfans' },
  { name: 'topics-youtube', url: 'https://api-dashboard.influencers.club/public/v1/discovery/classifier/yt-topics' },
];

const runDir = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(process.cwd(), 'logs', 'discovery-api');

let targetRun = runDir;
if (fs.statSync(runDir).isDirectory() && runDir.endsWith('discovery-api')) {
  const directories = fs.readdirSync(runDir)
    .filter((dir) => fs.statSync(path.join(runDir, dir)).isDirectory())
    .sort();
  const latest = directories.at(-1);
  if (!latest) {
    console.error('Unable to resolve discovery run directory');
    process.exit(1);
  }
  targetRun = path.join(runDir, latest);
}

const metaDir = path.join(targetRun, 'metadata');
fs.mkdirSync(metaDir, { recursive: true });

(async () => {
  for (const target of metaTargets) {
    try {
      const response = await fetch(target.url, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const data = await response.json();
      const filePath = path.join(metaDir, `${target.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Fetched ${target.name} (${response.status}) -> ${filePath}`);
    } catch (error) {
      console.error(`Failed to fetch ${target.name}`, error);
    }
  }
})();
