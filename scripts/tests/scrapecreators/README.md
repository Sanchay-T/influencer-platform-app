# ScrapeCreators API Testing Framework

Comprehensive testing suite for the ScrapeCreators Instagram Reels Search API.

## Overview

This testing framework provides automated tests for evaluating the ScrapeCreators API across multiple dimensions:

1. **H2: Parallel Concurrency Testing** - Measures API performance at different concurrency levels
2. **H1: Keyword Expansion Analysis** - Evaluates the trade-off between keyword expansion and result diversity
3. **H3: Deduplication Analysis** - Compares generic vs niche keywords for duplicate rates

## Directory Structure

```
scripts/tests/scrapecreators/
├── README.md                                   # This file
├── lib/
│   ├── api-client.mjs                         # ScrapeCreators API client & utilities
│   └── report-generator.mjs                   # Markdown report generation utilities
├── test-h1-keyword-expansion.mjs              # Keyword expansion test
├── test-h2-parallel-concurrency.mjs           # Concurrency test (PRIORITY)
└── test-h3-dedup-by-keyword-type.mjs          # Deduplication analysis test
```

## Setup

### Prerequisites

1. Node.js 18+ installed
2. API key for ScrapeCreators set in `.env.local`:
   ```
   SCRAPECREATORS_API_KEY=your_key_here
   ```

### Installation

No additional installation required - uses built-in Node modules and dotenv.

## Usage

### Running Tests

Each test can be run in two modes:

**Dry Run Mode** (no API calls, simulated data):
```bash
node scripts/tests/scrapecreators/test-h2-parallel-concurrency.mjs --dry-run
node scripts/tests/scrapecreators/test-h1-keyword-expansion.mjs --dry-run
node scripts/tests/scrapecreators/test-h3-dedup-by-keyword-type.mjs --dry-run
```

**Live Mode** (real API calls):
```bash
node scripts/tests/scrapecreators/test-h2-parallel-concurrency.mjs
node scripts/tests/scrapecreators/test-h1-keyword-expansion.mjs
node scripts/tests/scrapecreators/test-h3-dedup-by-keyword-type.mjs
```

### Test Descriptions

#### H2: Parallel Concurrency Test

**Purpose:** Find the optimal concurrency level for ScrapeCreators API calls

**What it tests:**
- Concurrency levels: 1, 2, 3
- Keywords: meditation, yoga, fitness, wellness, mindfulness
- Results per keyword: 10

**Metrics measured:**
- Throughput (requests/second)
- Success rate
- Average response time
- Error rates

**Output:** `docs/testing/reports/h2-parallel-concurrency-report.md`

**API Cost:** 15 calls (~$0.03)

---

#### H1: Keyword Expansion Test

**Purpose:** Evaluate if keyword expansion provides value vs latency cost

**What it tests:**
- Original keywords vs expanded variations
- Diversity gain measurement
- New creator discovery rate

**Test keywords:**
- "meditation" → 4 expanded variations
- "vegan recipes" → 4 expanded variations
- "home workout" → 4 expanded variations

**Metrics measured:**
- Original unique creators
- Expanded unique creators
- New creators discovered
- Diversity gain percentage
- Total time overhead

**Output:** `docs/testing/reports/h1-keyword-expansion-report.md`

**API Cost:** 15 calls (~$0.03)

---

#### H3: Deduplication Analysis

**Purpose:** Compare generic vs niche keywords for result quality

**What it tests:**
- Generic keywords (5): fitness, food, travel, fashion, beauty
- Niche keywords (5): long-tail specific phrases
- Results per keyword: 20

**Metrics measured:**
- Duplication rate
- Unique creator ratio
- Pairwise keyword overlap
- Efficiency score

**Output:** `docs/testing/reports/h3-dedup-by-keyword-type-report.md`

**API Cost:** 10 calls (~$0.02)

---

## Reports

All tests generate detailed Markdown reports in `docs/testing/reports/`:

- Executive summary
- Performance metrics tables
- Detailed statistics per configuration
- Key findings and recommendations
- Test configuration for reproducibility

### Reading Reports

Reports include:
- **Summary tables** - High-level metrics comparison
- **Detailed statistics** - Timing, success rates, reel counts
- **Sample results** - Individual keyword results
- **Recommendations** - Data-driven guidance for optimization

## API Client Library

The `lib/api-client.mjs` provides reusable utilities:

### ScrapeCreatorsClient

```javascript
import { ScrapeCreatorsClient } from './lib/api-client.mjs';

const client = new ScrapeCreatorsClient(apiKey);

// Single search
const result = await client.searchReels('meditation', 10);

// Batch search
const results = await client.batchSearch(['yoga', 'fitness'], 10);

// Parallel search with concurrency control
const results = await client.parallelSearch(['meditation', 'yoga'], 10, 3);
```

### Utility Functions

```javascript
import { calculateStats, formatTimestamp, sleep } from './lib/api-client.mjs';

// Calculate statistics from results
const stats = calculateStats(results);

// Format timestamp
const timestamp = formatTimestamp(); // "2025-11-27 08:24:12"

// Rate limiting delay
await sleep(1000); // Wait 1 second
```

## Report Generator Library

The `lib/report-generator.mjs` provides Markdown generation:

```javascript
import { MarkdownReportGenerator } from './lib/report-generator.mjs';

const report = new MarkdownReportGenerator('Title', 'Description');
report.addSection('Section Title', 'Content...');
report.addTable('Table Title', ['Header1', 'Header2'], [['row1col1', 'row1col2']]);
report.save('path/to/report.md');
```

## Cost Management

Each API call costs approximately **$0.002** (47 credits / 25,000 available credits).

**Estimated costs:**
- H2 Concurrency Test: ~$0.03 (15 calls)
- H1 Keyword Expansion: ~$0.03 (15 calls)
- H3 Deduplication: ~$0.02 (10 calls)

**Total for full suite:** ~$0.08

To minimize costs during development, always start with `--dry-run` mode.

## Extending the Tests

### Adding New Test Scenarios

1. Create a new test file: `test-h4-your-test.mjs`
2. Import the client and report libraries
3. Define your test configuration
4. Implement test logic
5. Generate and save report
6. Update this README

### Custom Keywords

Edit the `CONFIG` object in each test file to customize keywords:

```javascript
const CONFIG = {
  keywords: ['your', 'custom', 'keywords'],
  resultsPerKeyword: 15,
};
```

## Troubleshooting

### API Key Not Found

Error: `SCRAPECREATORS_API_KEY not found in environment`

**Solution:** Add the key to `.env.local` in the project root:
```
SCRAPECREATORS_API_KEY=your_key_here
```

### Timeout Errors

If API calls timeout, increase the timeout in the Bash command or reduce the number of keywords.

### Rate Limiting

The tests include automatic delays between requests to avoid rate limiting. If you see rate limit errors, increase the delay in the test scripts.

## Test Results Summary

### H2 Parallel Concurrency Test (Latest Run: 2025-11-27)

**Key Findings:**
- Best Throughput: Concurrency 3 at 0.10 req/s
- All tests: 100% success rate
- Concurrency 3 recommended for balance

**Performance Data:**
| Concurrency | Time | Throughput | Avg Timing |
|-------------|------|------------|------------|
| 1 | 101.71s | 0.05 req/s | 20.3s |
| 2 | 56.57s | 0.09 req/s | 17.5s |
| 3 | 51.58s | 0.10 req/s | 26.8s |

---

## Contributing

When adding new tests:
1. Follow the existing naming convention (`test-hX-description.mjs`)
2. Include `--dry-run` support
3. Generate Markdown reports to `docs/testing/reports/`
4. Update this README with test details
5. Include cost estimates

## License

Part of the Gemz influencer platform project.
