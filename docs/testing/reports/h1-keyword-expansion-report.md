# H1: Keyword Expansion Test Report

Compares original keyword search vs expanded keyword variations to measure latency cost and result diversity gain

**Generated:** 2025-11-27T08:45:37.074Z

---

## Executive Summary


This test evaluates the trade-off between keyword expansion and result quality:
- **Latency Cost:** How much longer does expansion take?
- **Diversity Gain:** How many new unique creators are discovered?
- **Value Assessment:** Is the extra time worth the additional results?
  

## Overall Metrics


- **Original Keywords Tested:** 3
- **Total Expanded Keywords:** 12
- **Avg Time per Original Keyword:** 18156.72ms
- **Avg Time per Expanded Search:** 19396.22ms
- **Total New Creators Discovered:** 131
- **Avg Diversity Gain:** 318.86%
  

## Keyword: "meditation"



### Diversity Metrics - "meditation"

| Metric | Value |
| --- | --- |
| Original Unique Creators | 14 |
| Expanded Unique Creators | 54 |
| Total Unique Creators | 60 |
| New Creators from Expansion | 46 |
| Diversity Gain | 328.57% |
| Total Time | 77.95s |


### Original Keyword Stats

| Metric | Value |
| --- | --- |
| Total Requests | 1 |
| Successful | 1 (100.00%) |
| Failed | 0 |
| Avg Timing | 24558.33ms |
| Min Timing | 24558.33ms |
| Max Timing | 24558.33ms |
| Median Timing | 24558.33ms |
| Total Reels | 15 |
| Avg Reels/Request | 15.00 |
| Credits Remaining | 17982 |


### Expanded Keywords Stats (4 variations)

| Metric | Value |
| --- | --- |
| Total Requests | 4 |
| Successful | 4 (100.00%) |
| Failed | 0 |
| Avg Timing | 13047.11ms |
| Min Timing | 10964.61ms |
| Max Timing | 18521.96ms |
| Median Timing | 11350.93ms |
| Total Reels | 60 |
| Avg Reels/Request | 15.00 |
| Credits Remaining | 17980 |


## Expanded Variations



- mindfulness meditation
- guided meditation
- meditation for beginners
- morning meditation

## Keyword: "vegan recipes"



### Diversity Metrics - "vegan recipes"

| Metric | Value |
| --- | --- |
| Original Unique Creators | 13 |
| Expanded Unique Creators | 47 |
| Total Unique Creators | 51 |
| New Creators from Expansion | 38 |
| Diversity Gain | 292.31% |
| Total Time | 116.55s |


### Original Keyword Stats

| Metric | Value |
| --- | --- |
| Total Requests | 1 |
| Successful | 1 (100.00%) |
| Failed | 0 |
| Avg Timing | 12683.36ms |
| Min Timing | 12683.36ms |
| Max Timing | 12683.36ms |
| Median Timing | 12683.36ms |
| Total Reels | 15 |
| Avg Reels/Request | 15.00 |
| Credits Remaining | 17972 |


### Expanded Keywords Stats (4 variations)

| Metric | Value |
| --- | --- |
| Total Requests | 4 |
| Successful | 4 (100.00%) |
| Failed | 0 |
| Avg Timing | 25665.84ms |
| Min Timing | 11405.14ms |
| Max Timing | 40944.10ms |
| Median Timing | 25157.06ms |
| Total Reels | 60 |
| Avg Reels/Request | 15.00 |
| Credits Remaining | 17970 |


## Expanded Variations



- easy vegan recipes
- vegan meal prep
- plant-based cooking
- vegan desserts

## Keyword: "home workout"



### Diversity Metrics - "home workout"

| Metric | Value |
| --- | --- |
| Original Unique Creators | 14 |
| Expanded Unique Creators | 54 |
| Total Unique Creators | 61 |
| New Creators from Expansion | 47 |
| Diversity Gain | 335.71% |
| Total Time | 96.29s |


### Original Keyword Stats

| Metric | Value |
| --- | --- |
| Total Requests | 1 |
| Successful | 1 (100.00%) |
| Failed | 0 |
| Avg Timing | 17228.46ms |
| Min Timing | 17228.46ms |
| Max Timing | 17228.46ms |
| Median Timing | 17228.46ms |
| Total Reels | 15 |
| Avg Reels/Request | 15.00 |
| Credits Remaining | 17962 |


### Expanded Keywords Stats (4 variations)

| Metric | Value |
| --- | --- |
| Total Requests | 4 |
| Successful | 4 (100.00%) |
| Failed | 0 |
| Avg Timing | 19475.70ms |
| Min Timing | 9414.52ms |
| Max Timing | 39286.54ms |
| Median Timing | 14600.86ms |
| Total Reels | 60 |
| Avg Reels/Request | 15.00 |
| Credits Remaining | 17960 |


## Expanded Variations



- home gym workout
- bodyweight exercises
- no equipment workout
- home fitness routine

## Recommendations


✅ **Keyword expansion is recommended** - significant diversity gain justifies the latency cost

**Key Insights:**
- Expansion adds ~327% more API call time
- Discovers ~319% more unique creators on average
- Consider selective expansion for high-value keywords only
  

## Test Configuration



```json
{
  "testKeywords": [
    "meditation",
    "vegan recipes",
    "home workout"
  ],
  "expansionMap": {
    "meditation": [
      "mindfulness meditation",
      "guided meditation",
      "meditation for beginners",
      "morning meditation"
    ],
    "vegan recipes": [
      "easy vegan recipes",
      "vegan meal prep",
      "plant-based cooking",
      "vegan desserts"
    ],
    "home workout": [
      "home gym workout",
      "bodyweight exercises",
      "no equipment workout",
      "home fitness routine"
    ]
  },
  "resultsPerKeyword": 15,
  "reportPath": "docs/testing/reports/h1-keyword-expansion-report.md"
}
```

