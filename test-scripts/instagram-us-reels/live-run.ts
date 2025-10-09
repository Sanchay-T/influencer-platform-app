import { runInstagramUsReelsPipeline } from '../../lib/instagram-us-reels/index';

async function main() {
const keyword = process.argv[2] ?? 'vegan snacks';
const transcriptsEnabled = process.argv.includes('--with-transcripts');
const serpEnabled = !process.argv.includes('--no-serp');
console.log('Running pipeline for keyword:', keyword, '| transcripts:', transcriptsEnabled);
const start = Date.now();
const results = await runInstagramUsReelsPipeline({ keyword }, {
  transcripts: transcriptsEnabled,
  serpEnabled,
});
  const duration = Date.now() - start;
  console.log('Pipeline completed in', duration, 'ms');
  console.log(JSON.stringify({ keyword, count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});
