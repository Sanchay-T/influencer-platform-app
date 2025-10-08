# Troubleshooting

### Reels < limit
1. Check STDOUT for `[serp]` counts – if too few handles were found, re-run with higher `--handles` or add more keyword variants.
2. Lower `--ai-threshold` slightly (e.g., 0.6 → 0.5) and manually review borderline reels.
3. Increase `--maxPerCreator` temporarily (3 → 4) for niche topics.
4. Inspect `aiHandleSuggestions` in the JSON to seed future runs.

### Runtime too high (>15 min)
- Raise `--stopMultiplier` only if necessary; otherwise lower it (e.g., 2.0 → 1.5).
- Drop `--handles` from 200 to 120 if the first wave already supplies enough reels.
- Reduce recency window (`--days=90`) to avoid parsing older heavy feeds.

### Frequent ScrapeCreators timeouts
- Lower concurrency (`--concurrency=10`).
- Add `--stopMultiplier` closer to 1.5 so we bail earlier.
- Retry counts are already baked in; persistent failure means the handle is private/invalid – remove it from seeds.

### AI relevance seems off
- Inspect `aiReason` in the JSON; if GPT is misunderstanding the topic, override `--topic` with a clearer descriptor (e.g., `--topic="mobility coach"`).
- Adjust threshold per vertical (e.g., medical vs. lifestyle).

### Non-US creators slipping in
- Ensure captions/bios actually contain US hints; if not, tighten `--ai-threshold` or add location keywords in `generateKeywordVariants` prompt.

### CSV missing columns
- The CSV is written from the JSON payload. Delete old files before re-running to avoid confusion.

### QStash integration notes
- Trigger the CLI with a job payload containing `keyword`, `limit`, and any overrides.
- Cap concurrent jobs to 2–3 to stay within ScrapeCreators’ soft limits.
- Persist logs to storage for later inspection (`stdout` contains the run summary).
