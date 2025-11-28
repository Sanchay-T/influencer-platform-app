# H2: Parallel Concurrency Test Report

Tests ScrapeCreators API performance at different concurrency levels (1-5 parallel requests)

**Generated:** 2025-11-27T08:24:12.142Z

---

## Executive Summary


This test evaluates API performance under different concurrency levels to identify:
- Optimal concurrency for throughput
- Error rates at high concurrency
- Response time degradation
- Rate limiting thresholds
  

### Performance Summary

| Concurrency | Total Time (s) | Throughput (req/s) | Success Rate | Avg Timing (ms) | Failed Requests |
| --- | --- | --- | --- | --- | --- |
| 1 | 101.71 | 0.05 | 100.00% | 20341.98 | 0 |
| 2 | 56.57 | 0.09 | 100.00% | 17493.73 | 0 |
| 3 | 51.58 | 0.10 | 100.00% | 26785.91 | 0 |


## Concurrency Level: 1


**Total Time:** 101.71s
**Throughput:** 0.05 requests/second
**Keywords Tested:** 5
**Results per Keyword:** 10
    

### Statistics - Concurrency 1

| Metric | Value |
| --- | --- |
| Total Requests | 5 |
| Successful | 5 (100.00%) |
| Failed | 0 |
| Avg Timing | 20341.98ms |
| Min Timing | 9465.44ms |
| Max Timing | 48399.45ms |
| Median Timing | 12940.96ms |
| Total Reels | 50 |
| Avg Reels/Request | 10.00 |
| Credits Remaining | 18049 |


### Sample Results - Concurrency 1

| Keyword | Status | Reels | Timing (ms) | Error |
| --- | --- | --- | --- | --- |
| meditation | ✓ Success | 10 | 9708.10 | - |
| yoga | ✓ Success | 10 | 48399.45 | - |
| fitness | ✓ Success | 10 | 12940.96 | - |
| wellness | ✓ Success | 10 | 21195.95 | - |
| mindfulness | ✓ Success | 10 | 9465.44 | - |


## Concurrency Level: 2


**Total Time:** 56.57s
**Throughput:** 0.09 requests/second
**Keywords Tested:** 5
**Results per Keyword:** 10
    

### Statistics - Concurrency 2

| Metric | Value |
| --- | --- |
| Total Requests | 5 |
| Successful | 5 (100.00%) |
| Failed | 0 |
| Avg Timing | 17493.73ms |
| Min Timing | 4875.72ms |
| Max Timing | 36096.20ms |
| Median Timing | 15618.91ms |
| Total Reels | 50 |
| Avg Reels/Request | 10.00 |
| Credits Remaining | 18044 |


### Sample Results - Concurrency 2

| Keyword | Status | Reels | Timing (ms) | Error |
| --- | --- | --- | --- | --- |
| meditation | ✓ Success | 10 | 10406.37 | - |
| yoga | ✓ Success | 10 | 20471.45 | - |
| fitness | ✓ Success | 10 | 15618.91 | - |
| mindfulness | ✓ Success | 10 | 4875.72 | - |
| wellness | ✓ Success | 10 | 36096.20 | - |


## Concurrency Level: 3


**Total Time:** 51.58s
**Throughput:** 0.10 requests/second
**Keywords Tested:** 5
**Results per Keyword:** 10
    

### Statistics - Concurrency 3

| Metric | Value |
| --- | --- |
| Total Requests | 5 |
| Successful | 5 (100.00%) |
| Failed | 0 |
| Avg Timing | 26785.91ms |
| Min Timing | 11734.62ms |
| Max Timing | 37675.26ms |
| Median Timing | 34442.79ms |
| Total Reels | 50 |
| Avg Reels/Request | 10.00 |
| Credits Remaining | 18039 |


### Sample Results - Concurrency 3

| Keyword | Status | Reels | Timing (ms) | Error |
| --- | --- | --- | --- | --- |
| fitness | ✓ Success | 10 | 11734.62 | - |
| yoga | ✓ Success | 10 | 13900.50 | - |
| meditation | ✓ Success | 10 | 36176.37 | - |
| wellness | ✓ Success | 10 | 34442.79 | - |
| mindfulness | ✓ Success | 10 | 37675.26 | - |


## Key Findings


- **Best Throughput:** Concurrency 3 at 0.10 req/s
- **Best Success Rate:** Concurrency 1 at 100.00%
- **Recommended Concurrency:** 3 (balances speed and reliability)
  

## Test Configuration



```json
{
  "concurrencyLevels": [
    1,
    2,
    3
  ],
  "keywords": [
    "meditation",
    "yoga",
    "fitness",
    "wellness",
    "mindfulness"
  ],
  "resultsPerKeyword": 10,
  "reportPath": "docs/testing/reports/h2-parallel-concurrency-report.md"
}
```

