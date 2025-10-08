# CLI Usage

All commands are run from repo root. Core script:

```bash
npx ts-node --transpile-only scripts/prototype-scrapecreators-feed.ts [options]
```

## Common Flags
| Flag | Description | Example |
|------|-------------|---------|
| `--keyword` | Primary keyword to search | `--keyword="nutritionist"` |
| `--handles` | Max handles to crawl (staged) | `--handles=120` |
| `--limit` | Number of reels to deliver | `--limit=60` |
| `--days` | Recency window in days | `--days=120` |
| `--concurrency` | Parallel ScrapeCreators requests | `--concurrency=15` |
| `--maxPerCreator` | Cap reels per creator | `--maxPerCreator=3` |
| `--ai-threshold` | GPT-4o relevance cutoff | `--ai-threshold=0.6` |
| `--ai-seed` | Enable AI handle expansion | `--ai-seed` |
| `--ai-seed-limit` | Max handles returned by AI | `--ai-seed-limit=150` |
| `--stopMultiplier` | Early-stop multiplier | `--stopMultiplier=2.0` |
| `--topic` | Override topic hint for classifier | `--topic="fitness coach"` |

## Example Commands

### Nutritionist
```bash
npx ts-node --transpile-only scripts/prototype-scrapecreators-feed.ts \
  --keyword="nutritionist" \
  --limit=60 --handles=120 --days=120 --concurrency=12 \
  --maxPerCreator=3 --ai-threshold=0.6 --ai-seed --ai-seed-limit=120 --stopMultiplier=2.0
```

### Vegan Recipes
```bash
npx ts-node --transpile-only scripts/prototype-scrapecreators-feed.ts \
  --keyword="vegan recipes" \
  --limit=60 --handles=120 --days=120 --concurrency=12 \
  --maxPerCreator=3 --ai-threshold=0.6 --ai-seed --ai-seed-limit=120 --stopMultiplier=2.0
```

### Fitness Coach (looser threshold + higher cap)
```bash
npx ts-node --transpile-only scripts/prototype-scrapecreators-feed.ts \
  --keyword="fitness coach" \
  --limit=60 --handles=200 --days=120 --concurrency=15 \
  --maxPerCreator=4 --ai-threshold=0.5 --ai-seed --ai-seed-limit=150 --stopMultiplier=2.0
```

## Outputs
- JSON written to `logs/scrapecreators/feeds/feed-<primary-handle>-<timestamp>.json`
- CSV written alongside the JSON
- STDOUT includes SERP queries, AI expansion stats, runtime, and warnings.

See `troubleshooting.md` if reels < limit or runtime drifts upward.
