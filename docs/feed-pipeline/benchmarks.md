# Benchmarks (Oct 2025)

| Keyword | Handles touched | Reels harvested | Reels delivered | Unique creators | Median AI relevance | Runtime |
|---------|-----------------|-----------------|-----------------|-----------------|---------------------|---------|
| nutritionist | ~120 | 118 | 60 | 26 | ~0.90 | ~12.6 min |
| vegan recipes | ~110 | 112 | 60 | 26 | ~0.85 | ~9.5 min |
| fitness coach | ~180 | 132 | 60 | 17 | ~0.70 | ~10.0 min |

Notes:
- Runtime dominated by ScrapeCreators requests; GPT-4o calls add <30s per run.
- Fitness coach threshold lowered to 0.5 and creator cap raised to 4 to reach quota.
- Early-stop multiplier at 2.0 collects ~2× target reels before trimming.

Update this table after major parameter changes or new vertical validations.
