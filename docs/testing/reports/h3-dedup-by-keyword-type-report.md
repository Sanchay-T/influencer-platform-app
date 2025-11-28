# H3: Deduplication Analysis by Keyword Type

Compares duplicate rates between generic and niche keywords to optimize search strategy

**Generated:** 2025-11-27T08:49:46.662Z

---

## Executive Summary


This test evaluates how keyword specificity affects result duplication:
- **Generic Keywords:** Broad terms like "fitness", "food", "travel"
- **Niche Keywords:** Specific long-tail phrases like "keto meal prep for beginners"
- **Goal:** Determine if niche keywords provide better creator diversity
  

### Generic vs Niche Comparison

| Metric | Generic Keywords | Niche Keywords | Difference |
| --- | --- | --- | --- |
| Total Reels | 100 | 100 | - |
| Unique Creators | 97 | 86 | - |
| Duplicate Reels | 3 | 14 | - |
| Duplication Rate | 3.00% | 14.00% | 11.00% |
| Avg Pairwise Overlap | 0.00% | 0.00% | 0.00% |
| Efficiency | 97.00% | 86.00% | -11.00% |


## Generic Keywords Analysis


**Keywords Tested:** 5
**Total API Calls:** 5
  

### Generic Keywords Stats

| Metric | Value |
| --- | --- |
| Total Requests | 5 |
| Successful | 5 (100.00%) |
| Failed | 0 |
| Avg Timing | 24435.18ms |
| Min Timing | 11687.48ms |
| Max Timing | 49124.57ms |
| Median Timing | 20004.71ms |
| Total Reels | 100 |
| Avg Reels/Request | 20.00 |
| Credits Remaining | 17952 |


## Generic Keywords List



- fitness
- food
- travel
- fashion
- beauty

## Niche Keywords Analysis


**Keywords Tested:** 5
**Total API Calls:** 5
  

### Niche Keywords Stats

| Metric | Value |
| --- | --- |
| Total Requests | 5 |
| Successful | 5 (100.00%) |
| Failed | 0 |
| Avg Timing | 22367.41ms |
| Min Timing | 14116.19ms |
| Max Timing | 44468.23ms |
| Median Timing | 19306.39ms |
| Total Reels | 100 |
| Avg Reels/Request | 20.00 |
| Credits Remaining | 17942 |


## Niche Keywords List



- keto meal prep for beginners
- sustainable fashion brands
- solo female travel safety
- natural skincare routine
- home gym equipment reviews

## Key Findings


⚠️ **Generic keywords performed better** - 11.00% better creator diversity

**Insights:**
- Generic duplication rate: 3.00%
- Niche duplication rate: 14.00%
- Generic pairwise overlap: 0.00%
- Niche pairwise overlap: 0.00%

**Recommendations:**
- Generic keywords may be sufficient for broad discovery
- Niche keywords useful for targeted campaigns
- Consider cost/benefit of longer keyword phrases
  

## Test Configuration



```json
{
  "genericKeywords": [
    "fitness",
    "food",
    "travel",
    "fashion",
    "beauty"
  ],
  "nicheKeywords": [
    "keto meal prep for beginners",
    "sustainable fashion brands",
    "solo female travel safety",
    "natural skincare routine",
    "home gym equipment reviews"
  ],
  "resultsPerKeyword": 20,
  "reportPath": "docs/testing/reports/h3-dedup-by-keyword-type-report.md"
}
```

