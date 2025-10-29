# Product Requirements Document: Multi-Keyword Sequential Processing Fix

**Status:** Ready for Implementation
**Priority:** P0 (Critical Bug Fix)
**Target Release:** Next Sprint
**Assignee:** [Intern Name]
**Estimated Effort:** 2-3 days
**Last Updated:** 2025-10-28

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Current Architecture Analysis](#current-architecture-analysis)
4. [Proposed Solution](#proposed-solution)
5. [Technical Specifications](#technical-specifications)
6. [Implementation Guide](#implementation-guide)
7. [Testing Strategy](#testing-strategy)
8. [Success Metrics](#success-metrics)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Rollback Plan](#rollback-plan)
11. [References](#references)

---

## 1. Executive Summary

### Problem
When users submit Instagram searches with multiple keywords (e.g., `["colgate", "pepsodent", "dabur"]`), the system:
- ❌ Only processes the **first 2 keywords** repeatedly
- ❌ **Never reaches the 3rd keyword** ("dabur" in this example)
- ❌ Reports **inflated progress** (95% when actually 32%)
- ❌ Delivers only **96 out of 300 requested results** (32% completion)
- ❌ Costs **$4.27 but fails to meet user expectations**

### Solution
Implement **Sequential Fair Distribution** architecture that:
- ✅ **Processes ALL keywords** exactly once in Phase 1
- ✅ **Guarantees 100% keyword coverage** (no keywords skipped)
- ✅ **Reports accurate progress** (no forced inflation)
- ✅ **Delivers ~300 results** as requested
- ✅ **Costs ~$2.85** for better efficiency
- ✅ **Fair distribution** (~100 results per keyword)

### Impact
- **User Satisfaction**: Users get creators from ALL requested keywords
- **Cost Efficiency**: 5× better (from $0.044 to $0.0095 per creator)
- **Predictability**: Consistent behavior, no random stops
- **Trust**: Accurate progress reporting

---

## 2. Problem Statement

### 2.1 User Story

**As a** marketing professional
**I want to** search for Instagram creators across multiple brand keywords
**So that** I can discover influencers in different niches relevant to my campaign

**Current Experience (Broken):**
```
User searches: ["colgate", "pepsodent", "dabur"]
Expected: ~100 creators per keyword
Actual: 119 colgate, 68 pepsodent, 0 dabur ❌
Result: Missing entire category (dabur creators)
```

**Desired Experience (Fixed):**
```
User searches: ["colgate", "pepsodent", "dabur"]
Expected: ~100 creators per keyword
Actual: 95 colgate, 118 pepsodent, 92 dabur ✅
Result: All keywords represented fairly
```

### 2.2 Business Impact

| Metric | Current (Broken) | Impact |
|--------|------------------|--------|
| **Keyword Coverage** | 67% (2/3 keywords) | Lost business opportunities |
| **Customer Complaints** | "Why didn't I get dabur results?" | Poor user experience |
| **Wasted API Costs** | $4.27 for 96 results | Inefficient spending |
| **Progress Misleading** | Shows 95% at 32% | Erodes trust |
| **Platform Reputation** | "System doesn't work" | Churn risk |

### 2.3 Root Cause Analysis

**Technical Root Causes:**

1. **Forced Progress Inflation** (`instagram-us-reels.ts:506`)
   ```typescript
   const finalProgress = Math.max(actualProgress, 95);
   // Forces ANY job to show 95%+ even if only 32% done
   ```

2. **No Keyword Resumption Logic**
   - Provider has no mechanism to track "already attempted keywords"
   - Each QStash invocation restarts from keyword index 0
   - Creates cycling pattern: colgate → pepsodent → colgate → pepsodent...

3. **Premature Completion**
   ```typescript
   await service.complete('completed', {});  // Line 526
   return { hasMore: false };  // Even if keywords remaining
   ```

**Why It Happens:**
- The Instagram US Reels Agent processes **ONE keyword per session** (by design)
- The Provider **expects multi-keyword processing** (incorrect assumption)
- Architectural mismatch causes keyword cycling instead of sequential progression

---

## 3. Current Architecture Analysis

### 3.1 How the Agent Works

The Instagram US Reels Agent (`/lib/instagram-us-reels/agent/runner.ts`) is a **stateless, single-keyword AI system**:

```
┌─────────────────────────────────────────────────────────┐
│ Agent Session (ONE KEYWORD)                             │
├─────────────────────────────────────────────────────────┤
│ Input: { keyword: "colgate", targetResults: 100 }      │
│                                                          │
│ Process:                                                 │
│   1. GPT-4o-mini orchestrates discovery (10 iterations) │
│   2. Calls Serper API for Instagram reel URLs          │
│   3. Calls ScrapeCreators for post/profile data        │
│   4. Filters for US-based creators                      │
│   5. Returns ~40-95 unique creators                     │
│                                                          │
│ Output: { keyword: "colgate", creators: [...] }        │
│                                                          │
│ Cost: ~$0.75-0.85 per keyword                          │
│ Duration: ~2-3 minutes                                  │
└─────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- ✅ **Stateless**: No memory between invocations
- ✅ **Single-purpose**: Designed for ONE keyword only
- ✅ **AI-driven**: GPT-4o-mini decides search strategy
- ✅ **Budget-limited**: 10 iterations maximum
- ✅ **Independent**: Each session is isolated

### 3.2 Current Provider Logic (Broken)

**File:** `/lib/search-engine/providers/instagram-us-reels.ts`
**Lines:** 238-534

```typescript
// CURRENT (BROKEN) LOGIC
for (const keyword of keywords) {
  // BUG: No tracking of attempted keywords
  if (processedResults >= targetResults) {
    break;  // Early exit
  }

  // Launch agent for ONE keyword
  const agentResult = await runInstagramUsReelsAgent({ keyword });

  // Process results...
  processedResults += agentResult.creators.length;
}

// BUG: Force progress to 95% minimum
const finalProgress = Math.max(actualProgress, 95);

// BUG: Mark as complete even if keywords remaining
await service.complete('completed', {});
return { hasMore: false };
```

**What Goes Wrong:**

```
Iteration 1: Process "colgate" (41 results)
Iteration 2: Process "pepsodent" (20 results)
Iteration 3: SHOULD be "dabur" BUT cycles back to "colgate" ❌
Iteration 4: Process "pepsodent" again (23 results)
Iteration 5: Process "colgate" third time (38 results)
Iteration 6: Process "pepsodent" third time (25 results)

Result: 96 total, but "dabur" never attempted ❌
Progress: 32% shown as 95% ❌
Status: "completed" despite missing keyword ❌
```

---

## 4. Proposed Solution

### 4.1 Architecture Overview

**Sequential Fair Distribution** with two phases:

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 1: Initial Pass (Guaranteed Coverage)                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ for (keyword of ["colgate", "pepsodent", "dabur"]) {           │
│   if (alreadyAttempted(keyword)) skip;  // Safety check         │
│   agent = launchAgent(keyword);                                 │
│   trackAttempt(keyword, agent.results);                         │
│ }                                                                │
│                                                                  │
│ Result: ALL 3 keywords attempted ✅                             │
│         ~85-95 results per keyword                              │
│         Total: ~260-285 results                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 2: Refinement Pass (Optional - if under target)          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ if (totalResults < target) {                                    │
│   weakestKeyword = findKeywordWithFewestResults();             │
│   agent = launchAgent(weakestKeyword);                         │
│   addResults(weakestKeyword, agent.results);                   │
│ }                                                                │
│                                                                  │
│ Result: Balanced distribution ✅                                │
│         ~100 results per keyword                                │
│         Total: ~300 results                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Design Principles

1. **Guaranteed Coverage**: Every keyword gets at least ONE attempt
2. **Fair Distribution**: Aim for equal results per keyword
3. **Accurate Reporting**: No progress inflation
4. **Predictable Cost**: 3-4 agent runs (not 6+)
5. **Graceful Degradation**: If one keyword fails, others still succeed

---

## 5. Technical Specifications

### 5.1 Data Structures

**New State Tracking:**

```typescript
interface KeywordTracker {
  attemptedKeywords: Set<string>;      // Which keywords we tried
  keywordResults: Map<string, number>; // Results count per keyword
  keywordAttempts: Map<string, number>; // Number of attempts per keyword
}

interface ProviderResult {
  status: 'completed' | 'partial';
  processedResults: number;
  hasMore: boolean;
  keywordBreakdown: Record<string, number>; // NEW: per-keyword counts
  metrics: SearchMetrics;
}
```

### 5.2 Algorithm Specification

**Phase 1: Sequential Processing**

```typescript
function processKeywordsSequentially(
  keywords: string[],
  targetTotal: number
): { totalResults: number; breakdown: Map<string, number> } {

  const targetPerKeyword = Math.ceil(targetTotal / keywords.length);
  const attemptedKeywords = new Set<string>();
  const keywordResults = new Map<string, number>();
  let totalResults = 0;

  // GUARANTEE: Each keyword processed once
  for (const keyword of keywords) {
    // Safety: Skip if already attempted
    if (attemptedKeywords.has(keyword)) {
      logger.warn(`Skipping duplicate keyword: ${keyword}`);
      continue;
    }

    logger.info(`Processing keyword: ${keyword} (target: ${targetPerKeyword})`);

    try {
      const agentResult = await runInstagramUsReelsAgent({
        keyword,
        targetResults: targetPerKeyword,
        jobId: this.jobId,
      });

      // Track attempt
      attemptedKeywords.add(keyword);
      keywordResults.set(keyword, agentResult.creators.length);
      totalResults += agentResult.creators.length;

      logger.info(`Completed ${keyword}: ${agentResult.creators.length} results`);

    } catch (error) {
      logger.error(`Failed to process ${keyword}:`, error);
      // Mark as attempted even if failed (don't retry in this phase)
      attemptedKeywords.add(keyword);
      keywordResults.set(keyword, 0);
    }
  }

  return { totalResults, breakdown: keywordResults };
}
```

**Phase 2: Refinement (if needed)**

```typescript
function refineResults(
  keywordResults: Map<string, number>,
  targetTotal: number,
  currentTotal: number
): number {

  const deficit = targetTotal - currentTotal;

  if (deficit <= 0) {
    logger.info('Target reached, skipping refinement');
    return 0;
  }

  // Find keyword with fewest results
  const entries = Array.from(keywordResults.entries());
  const [minKeyword, minCount] = entries.sort((a, b) => a[1] - b[1])[0];

  logger.info(`Refining ${minKeyword} (current: ${minCount}, need: ${deficit} more)`);

  try {
    const agentResult = await runInstagramUsReelsAgent({
      keyword: minKeyword,
      targetResults: deficit,
      jobId: this.jobId,
    });

    const additionalResults = agentResult.creators.length;
    keywordResults.set(minKeyword, minCount + additionalResults);

    return additionalResults;

  } catch (error) {
    logger.error(`Refinement failed for ${minKeyword}:`, error);
    return 0;
  }
}
```

**Progress Calculation (FIXED)**

```typescript
function calculateAccurateProgress(
  processedResults: number,
  targetResults: number
): number {

  // NO FORCED MINIMUM!
  const actualProgress = (processedResults / targetResults) * 100;

  // Cap at 100% (in case of over-collection)
  return Math.min(actualProgress, 100);
}
```

---

## 6. Implementation Guide

### 6.1 Files to Modify

| File Path | Lines to Change | Purpose |
|-----------|----------------|---------|
| `/lib/search-engine/providers/instagram-us-reels.ts` | 238-534 | Main provider logic |
| `/lib/search-engine/job-service.ts` | None | Already has necessary methods |
| `/app/api/qstash/process-search/route.ts` | 62-78 | Remove diagnostic logs (optional) |

### 6.2 Step-by-Step Implementation

#### **STEP 1: Add State Tracking Variables**

**Location:** `instagram-us-reels.ts` around line 230

**BEFORE:**
```typescript
let processedResults = job.processedResults ?? 0;
let cursor = job.cursor ?? 0;
let processedRuns = job.processedRuns ?? 0;
```

**AFTER:**
```typescript
let processedResults = job.processedResults ?? 0;
let cursor = job.cursor ?? 0;
let processedRuns = job.processedRuns ?? 0;

// ✅ NEW: Track keyword attempts
const attemptedKeywords = new Set<string>();
const keywordResults = new Map<string, number>();
const keywordAttempts = new Map<string, number>();
const targetPerKeyword = Math.ceil(targetResults / keywords.length);

logger.info('Multi-keyword processing initialized', {
  jobId: job.id,
  keywords,
  targetTotal: targetResults,
  targetPerKeyword,
}, LogCategory.SCRAPING);
```

#### **STEP 2: Replace Keyword Loop Logic**

**Location:** `instagram-us-reels.ts` lines 238-499

**BEFORE:**
```typescript
for (const keyword of keywords) {
  if (processedResults >= targetResults) {
    break;
  }

  // ... existing agent call logic ...
}
```

**AFTER:**
```typescript
// ✅ PHASE 1: Process each keyword exactly once
logger.info('🎯 PHASE 1: Processing each keyword once', {
  jobId: job.id,
  keywords,
}, LogCategory.SCRAPING);

for (const keyword of keywords) {
  // ✅ NEW: Skip if already attempted
  if (attemptedKeywords.has(keyword)) {
    logger.warn('Skipping already-attempted keyword', {
      jobId: job.id,
      keyword,
    }, LogCategory.SCRAPING);
    continue;
  }

  const keywordStartedAt = Date.now();
  logger.info('Instagram US Reels keyword run starting', {
    jobId: job.id,
    keyword,
    processedResults,
    targetForThisKeyword: targetPerKeyword,
  }, LogCategory.SCRAPING);

  structuredConsole.warn('[US_REELS][KEYWORD_START]', {
    jobId: job.id,
    keyword,
    processedResults,
    targetPerKeyword,
    timestamp: new Date().toISOString(),
  });

  let agentResult: InstagramUsReelsAgentResult | null = null;

  try {
    agentResult = await runInstagramUsReelsAgent({
      keyword,
      jobId: job.id,
    });

    successfulAgentRuns++;

    // ✅ NEW: Track this attempt
    attemptedKeywords.add(keyword);
    keywordAttempts.set(keyword, 1);

  } catch (agentError) {
    lastError = agentError instanceof Error ? agentError : new Error(String(agentError));
    logger.error('Instagram US Reels agent failed for keyword', lastError, {
      jobId: job.id,
      keyword,
    }, LogCategory.SCRAPING);

    // ✅ NEW: Track failed attempt (don't retry in Phase 1)
    attemptedKeywords.add(keyword);
    keywordAttempts.set(keyword, 1);
    keywordResults.set(keyword, 0);

    // Continue to next keyword instead of breaking
    metrics.batches.push({
      index: batchIndex++,
      size: 0,
      durationMs: Date.now() - keywordStartedAt,
      note: `Failed keyword: ${keyword}`,
    });

    structuredConsole.error('[US_REELS][KEYWORD_FAILED]', {
      jobId: job.id,
      keyword,
      error: lastError.message,
      timestamp: new Date().toISOString(),
    });

    continue; // ✅ NEW: Continue to next keyword
  }

  // ... rest of existing logic for processing agentResult ...
  // (Keep all the handle grouping, merging, deduplication logic)

  // ✅ NEW: Track results for this keyword
  const keywordResultCount = agentResult.creators.length;
  keywordResults.set(keyword, keywordResultCount);

  logger.info('Instagram US Reels keyword completed', {
    jobId: job.id,
    keyword,
    processedResults,
    keywordResults: keywordResultCount,
    durationMs: Date.now() - keywordStartedAt,
  }, LogCategory.SCRAPING);

  structuredConsole.warn('[US_REELS][KEYWORD_COMPLETE]', {
    jobId: job.id,
    keyword,
    processedResults,
    keywordResults: keywordResultCount,
    timestamp: new Date().toISOString(),
  });

  // ✅ REMOVED: Don't check targetResults here anymore
  // Let Phase 1 complete all keywords first
}

logger.info('✅ Phase 1 complete - all keywords attempted', {
  jobId: job.id,
  attemptedCount: attemptedKeywords.size,
  totalKeywords: keywords.length,
  totalResults: processedResults,
  keywordBreakdown: Object.fromEntries(keywordResults),
}, LogCategory.SCRAPING);

// ✅ PHASE 2: Refinement pass if under target
if (processedResults < targetResults) {
  const deficit = targetResults - processedResults;
  logger.info('🔄 PHASE 2: Refinement pass needed', {
    jobId: job.id,
    currentResults: processedResults,
    targetResults,
    deficit,
  }, LogCategory.SCRAPING);

  // Find keyword with fewest results
  const keywordEntries = Array.from(keywordResults.entries());
  const sortedByResults = keywordEntries.sort((a, b) => a[1] - b[1]);

  if (sortedByResults.length > 0) {
    const [minKeyword, minCount] = sortedByResults[0];

    logger.info('Refining keyword with fewest results', {
      jobId: job.id,
      keyword: minKeyword,
      currentCount: minCount,
      targetAdditional: deficit,
    }, LogCategory.SCRAPING);

    try {
      const refinementResult = await runInstagramUsReelsAgent({
        keyword: minKeyword,
        jobId: job.id,
      });

      // Process refinement results (same logic as Phase 1)
      // ... (handle grouping, merging, etc.) ...

      const refinementCount = refinementResult.creators.length;
      keywordResults.set(minKeyword, minCount + refinementCount);
      keywordAttempts.set(minKeyword, 2);

      logger.info('Refinement pass completed', {
        jobId: job.id,
        keyword: minKeyword,
        additionalResults: refinementCount,
        newTotal: processedResults,
      }, LogCategory.SCRAPING);

    } catch (refinementError) {
      logger.error('Refinement pass failed', refinementError, {
        jobId: job.id,
        keyword: minKeyword,
      }, LogCategory.SCRAPING);
      // Continue anyway - we did our best
    }
  }
}
```

#### **STEP 3: Fix Progress Calculation**

**Location:** `instagram-us-reels.ts` lines 505-512

**BEFORE:**
```typescript
const finalProgressRaw = computeProgress(processedResults, targetResults);
const finalProgress = finalProgressRaw >= 99 ? 100 : Math.max(finalProgressRaw, 95);
await service.recordProgress({
  processedRuns,
  processedResults,
  cursor,
  progress: finalProgress,
});
```

**AFTER:**
```typescript
// ✅ FIXED: No forced minimum progress
const finalProgressRaw = computeProgress(processedResults, targetResults);
const finalProgress = Math.min(finalProgressRaw, 100); // Cap at 100%, no floor

logger.info('Final progress calculated', {
  jobId: job.id,
  processedResults,
  targetResults,
  actualProgress: finalProgressRaw,
  reportedProgress: finalProgress,
}, LogCategory.SCRAPING);

await service.recordProgress({
  processedRuns,
  processedResults,
  cursor,
  progress: finalProgress,
});
```

#### **STEP 4: Update Completion Logic**

**Location:** `instagram-us-reels.ts` lines 526-534

**BEFORE:**
```typescript
await service.complete('completed', {});

return {
  status: 'completed',
  processedResults,
  cursor: processedResults,
  hasMore: false,
  metrics,
};
```

**AFTER:**
```typescript
// ✅ IMPROVED: Add keyword breakdown to completion
await service.complete('completed', {});

const keywordBreakdown = Object.fromEntries(keywordResults);

logger.info('Job completed with keyword breakdown', {
  jobId: job.id,
  totalResults: processedResults,
  targetResults,
  completionRate: `${((processedResults / targetResults) * 100).toFixed(1)}%`,
  keywordBreakdown,
  attemptedKeywords: Array.from(attemptedKeywords),
  missedKeywords: keywords.filter(k => !attemptedKeywords.has(k)),
}, LogCategory.SCRAPING);

return {
  status: 'completed',
  processedResults,
  cursor: processedResults,
  hasMore: false,
  metrics,
  // ✅ NEW: Include keyword breakdown
  keywordBreakdown,
};
```

#### **STEP 5: Update searchParams Storage**

**Location:** `instagram-us-reels.ts` around line 300

**BEFORE:**
```typescript
await service.updateSearchParams({
  lastKeyword: keyword,
  // ...
});
```

**AFTER:**
```typescript
await service.updateSearchParams({
  lastKeyword: keyword,
  // ✅ NEW: Track attempted keywords for debugging
  attemptedKeywords: Array.from(attemptedKeywords),
  keywordBreakdown: Object.fromEntries(keywordResults),
  // ...
});
```

### 6.3 Code Review Checklist

Before submitting PR, verify:

- [ ] All keywords in the array are attempted at least once
- [ ] `attemptedKeywords` Set is populated correctly
- [ ] `keywordResults` Map tracks counts per keyword
- [ ] Progress calculation has NO `Math.max(x, 95)` inflation
- [ ] Phase 2 refinement only runs if `processedResults < targetResults`
- [ ] Errors in one keyword don't block other keywords
- [ ] Logging includes keyword breakdown in final results
- [ ] `searchParams` includes `attemptedKeywords` for debugging
- [ ] Test script (`test-keyword-efficiency.js`) still passes
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Code follows existing formatting (`npm run lint`)

---

## 7. Testing Strategy

### 7.1 Unit Testing

**Test File:** `test-keyword-efficiency.js` (already created)

**Run Test:**
```bash
node test-keyword-efficiency.js
```

**Expected Output:**
```
✅ Keywords Processed: 3/3 (100%)
✅ Total Results: 318/300 (106%)
✅ Keywords MISSED: NONE! 🎉
✅ Cost per Creator: $0.0101 (vs $0.0102 before)
```

### 7.2 Integration Testing

**Test Case 1: Three Keywords (Happy Path)**

```bash
# Start dev server
npm run dev

# In a separate terminal, create test search via UI or API
curl -X POST http://localhost:3000/api/scraping/instagram-reels \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["nike", "adidas", "puma"],
    "targetResults": 300,
    "campaignId": "test-campaign-id"
  }'
```

**Expected Behavior:**
1. Agent Session #1 processes "nike" → ~85-95 results
2. Agent Session #2 processes "adidas" → ~85-95 results
3. Agent Session #3 processes "puma" → ~85-95 results
4. Agent Session #4 refines keyword with fewest results → +25-40 results
5. Total: ~295-320 results
6. All 3 keywords have entries in final results

**Verification:**
```bash
# Check job in database
node -e "
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const DATABASE_URL = process.env.DATABASE_URL;
const client = postgres(DATABASE_URL);
const db = drizzle(client);
const job = await db.execute('SELECT keywords, search_params, processed_results FROM scraping_jobs WHERE id = \\'<job-id>\\'');
console.log('Keywords:', job[0].keywords);
console.log('Attempted:', job[0].search_params.attemptedKeywords);
console.log('Breakdown:', job[0].search_params.keywordBreakdown);
console.log('Total:', job[0].processed_results);
"
```

**Test Case 2: Single Keyword (Edge Case)**

```json
{
  "keywords": ["colgate"],
  "targetResults": 100
}
```

**Expected:**
- 1 agent session
- ~85-95 results
- No refinement needed (or one refinement to reach 100)
- Completes successfully

**Test Case 3: Five Keywords (Stress Test)**

```json
{
  "keywords": ["brand1", "brand2", "brand3", "brand4", "brand5"],
  "targetResults": 500
}
```

**Expected:**
- 5 agent sessions in Phase 1
- 1-2 refinement sessions in Phase 2
- ~100 results per keyword
- Total: ~500 results
- All 5 keywords represented

**Test Case 4: Keyword Failure Recovery**

Temporarily break one keyword (use invalid keyword like "@@@@invalid@@@@"):

```json
{
  "keywords": ["colgate", "@@@@invalid@@@@", "dabur"],
  "targetResults": 300
}
```

**Expected:**
- Session #1: "colgate" succeeds → ~95 results
- Session #2: "@@@@invalid@@@@" fails → 0 results
- Session #3: "dabur" still runs → ~95 results
- Refinement runs for successful keyword
- Job completes with 2/3 keywords successful

### 7.3 Real-World Testing

**Pre-Production Checklist:**

1. **Test with actual user account**
   - Use test account: `falore7715@filipx.com`
   - Run search: `["airpods", "nike", "adidas"]`
   - Verify all 3 keywords in results

2. **Monitor costs**
   - Expected: ~$2.50-3.00 for 300 results
   - Check OpenAI usage dashboard
   - Check ScrapeCreators credit consumption

3. **Check progress updates**
   - Frontend should show accurate progress
   - No jumps from 32% to 95%
   - Smooth progression: 0% → 33% → 67% → 100%

4. **Verify CSV export**
   - Download CSV of results
   - Check `search_keyword` column
   - Ensure all 3 keywords represented

---

## 8. Success Metrics

### 8.1 Quantitative Metrics

| Metric | Before (Broken) | Target (Fixed) | How to Measure |
|--------|----------------|----------------|----------------|
| **Keyword Coverage** | 67% (2/3) | 100% (3/3) | Count unique keywords in `attemptedKeywords` |
| **Result Completion** | 32% (96/300) | 95%+ (285+/300) | `processedResults / targetResults` |
| **Cost Efficiency** | $0.044/creator | <$0.012/creator | `totalCost / processedResults` |
| **Progress Accuracy** | 95% at 32% actual | ±5% of actual | Compare `reportedProgress` to `actualProgress` |
| **Agent Runs** | 6 (inefficient) | 3-4 (optimal) | Count agent invocations |

### 8.2 Qualitative Metrics

- **User Satisfaction**: No complaints about "missing keywords"
- **Predictability**: Consistent behavior across searches
- **Trust**: Progress bar reflects reality
- **Debugging**: Easy to see which keywords succeeded/failed

### 8.3 Monitoring Dashboards

**Add to Monitoring:**

```typescript
// Log keyword breakdown for analytics
logger.info('ANALYTICS: Multi-keyword search completed', {
  userId: job.userId,
  keywordCount: keywords.length,
  attemptedCount: attemptedKeywords.size,
  coverageRate: (attemptedKeywords.size / keywords.length) * 100,
  avgResultsPerKeyword: processedResults / attemptedKeywords.size,
  totalCost: metrics.totalCostUsd,
  costPerCreator: metrics.totalCostUsd / processedResults,
}, LogCategory.ANALYTICS);
```

---

## 9. Edge Cases & Error Handling

### 9.1 Edge Case Matrix

| Scenario | Expected Behavior | Handling |
|----------|------------------|----------|
| **All keywords fail** | Job status = 'error' | Throw error after Phase 1 if `successfulAgentRuns === 0` |
| **First keyword fails** | Continue to next keywords | Catch error, mark attempted, continue loop |
| **Last keyword fails** | Job still completes | Phase 2 refinement may help |
| **Duplicate keywords** | Process each once | `Set<string>` deduplicates automatically |
| **Empty keywords array** | Throw validation error | Check `keywords.length > 0` before starting |
| **Target < keyword count** | Reduce per-keyword target | `targetPerKeyword = Math.max(10, Math.ceil(target / count))` |
| **Agent timeout** | Mark keyword as attempted | Set timeout on agent call, catch TimeoutError |
| **QStash failure** | Retry or fail gracefully | Existing QStash retry logic handles this |
| **Database write fails** | Retry with backoff | Existing DB error handling applies |

### 9.2 Error Handling Code

**Timeout Protection:**

```typescript
const AGENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

try {
  const agentResult = await Promise.race([
    runInstagramUsReelsAgent({ keyword, jobId: job.id }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Agent timeout')), AGENT_TIMEOUT_MS)
    )
  ]);

} catch (error) {
  if (error.message === 'Agent timeout') {
    logger.error('Agent timed out', { keyword, jobId: job.id });
    attemptedKeywords.add(keyword); // Don't retry
    keywordResults.set(keyword, 0);
    continue; // Next keyword
  }
  throw error; // Other errors bubble up
}
```

**Validation:**

```typescript
// At start of provider function
if (!keywords || keywords.length === 0) {
  throw new Error('Keywords array is empty');
}

if (targetResults < keywords.length * 10) {
  logger.warn('Target results very low for keyword count', {
    keywords: keywords.length,
    targetResults,
  });
  // Adjust target per keyword to minimum 10
  targetPerKeyword = Math.max(10, Math.ceil(targetResults / keywords.length));
}
```

---

## 10. Rollback Plan

### 10.1 Git Strategy

**Before Implementation:**

```bash
# Create feature branch
git checkout -b fix/multi-keyword-sequential-processing

# Make changes...
git add .
git commit -m "feat: implement sequential fair keyword distribution

- Guarantee all keywords processed in Phase 1
- Add refinement pass in Phase 2 for balanced results
- Fix progress inflation bug (remove forced 95%)
- Add keyword breakdown tracking
- Improve error handling for failed keywords

Fixes issue where 3rd keyword never processed.
Test results show 100% keyword coverage vs 67% before.

References: test-keyword-efficiency.js
"
```

### 10.2 Deployment Strategy

**Staged Rollout:**

1. **Deploy to dev environment**
   - Test with 5-10 searches
   - Verify keyword coverage
   - Check costs and performance

2. **Deploy to staging**
   - Run full test suite
   - Test with production-like data
   - Monitor for 24 hours

3. **Deploy to production (soft launch)**
   - Enable for 10% of users (feature flag)
   - Monitor metrics closely
   - Collect feedback

4. **Full production rollout**
   - Enable for 100% of users
   - Announce fix to affected users

### 10.3 Rollback Procedure

**If issues detected:**

```bash
# Option 1: Revert commit
git revert <commit-hash>
git push origin main

# Option 2: Restore from backup
git checkout main
git reset --hard <previous-good-commit>
git push --force origin main

# Option 3: Feature flag (if implemented)
# Set ENABLE_SEQUENTIAL_KEYWORDS=false in environment
```

**Rollback Triggers:**

- Keyword coverage drops below 80%
- Cost per creator increases by 50%+
- Error rate increases above 5%
- User complaints about missing keywords continue

### 10.4 Monitoring During Rollout

**Key Dashboards:**

1. **Keyword Coverage Rate**
   ```sql
   SELECT
     AVG(attempted_count::float / keyword_count) as coverage_rate
   FROM (
     SELECT
       jsonb_array_length(keywords) as keyword_count,
       jsonb_array_length(search_params->'attemptedKeywords') as attempted_count
     FROM scraping_jobs
     WHERE platform = 'Instagram'
       AND created_at > NOW() - INTERVAL '1 hour'
   ) subquery;
   ```

2. **Cost Efficiency**
   ```sql
   SELECT
     AVG(total_cost / NULLIF(processed_results, 0)) as cost_per_creator
   FROM scraping_jobs
   WHERE platform = 'Instagram'
     AND status = 'completed'
     AND created_at > NOW() - INTERVAL '1 hour';
   ```

3. **Progress Accuracy**
   - Compare `progress` field to `(processed_results / target_results) * 100`
   - Alert if difference > 10%

---

## 11. References

### 11.1 Related Documentation

- **Agent Architecture**: `/lib/instagram-us-reels/README.md`
- **Provider Logic**: `/lib/search-engine/providers/instagram-us-reels.ts`
- **Database Schema**: `/lib/db/schema.ts` (scrapingJobs table)
- **Testing Guide**: `/docs/testing/instagram-scraping.md`

### 11.2 External APIs

- **OpenAI Responses API**: https://platform.openai.com/docs/api-reference/responses
- **Serper API**: https://serper.dev/docs
- **ScrapeCreators API**: https://docs.scrapecreators.com/

### 11.3 Test Scripts

- **Unit Test**: `/test-keyword-efficiency.js`
- **Integration Test**: `/tests/instagram-multi-keyword.test.ts` (create this)

### 11.4 Debugging Tools

**Check Job Status:**
```bash
node analyze-run11-complete.js
```

**Check Logs:**
```bash
# Find job logs
jq 'select(.context.jobId == "<job-id>")' logs/development/scraping-2025-10-28.log

# Check keyword progression
jq 'select(.message | contains("keyword"))' logs/development/scraping-2025-10-28.log
```

### 11.5 Support Contacts

- **Code Owner**: [Lead Engineer Name]
- **Intern Mentor**: [Mentor Name]
- **Slack Channel**: #instagram-scraping-team
- **On-Call**: Check PagerDuty rotation

---

## Appendix A: Quick Start for Intern

**Day 1 (Morning):**
1. Read this PRD completely (2 hours)
2. Run `test-keyword-efficiency.js` to understand expected behavior
3. Review current provider code (`instagram-us-reels.ts`)
4. Ask questions in Slack

**Day 1 (Afternoon):**
1. Create feature branch
2. Implement STEP 1: Add state tracking
3. Commit and push
4. Verify TypeScript compiles

**Day 2 (Morning):**
1. Implement STEP 2: Replace keyword loop
2. Test with `console.log` debugging
3. Commit progress

**Day 2 (Afternoon):**
1. Implement STEP 3: Fix progress calculation
2. Implement STEP 4: Update completion logic
3. Run unit test
4. Fix any issues

**Day 3 (Morning):**
1. Implement STEP 5: Update searchParams
2. Run integration test (real Instagram search)
3. Fix any bugs

**Day 3 (Afternoon):**
1. Code review with mentor
2. Write tests
3. Submit PR
4. Deploy to dev environment

---

## Appendix B: FAQ

**Q: Why not process all keywords in parallel?**
A: Would require 3 simultaneous agent sessions ($2.50 upfront cost), may hit rate limits, harder to balance results. Sequential is simpler and more cost-predictable.

**Q: What if one keyword returns 0 results?**
A: That's fine - job still completes. The `keywordBreakdown` will show which keywords worked. User can adjust search terms.

**Q: Should we retry failed keywords?**
A: Not in Phase 1 (would delay other keywords). Phase 2 refinement may help if it picks the failed keyword.

**Q: How do we handle very long keyword arrays (10+ keywords)?**
A: Current design works fine. Each keyword takes ~2-3 min, so 10 keywords = ~30 min total (within serverless limits).

**Q: What if target results is very high (1000+)?**
A: Phase 2 may run multiple times. Consider adding loop: `while (totalResults < target && attempts < 3) { refine(); }`

**Q: Can users see per-keyword breakdown in UI?**
A: Not yet - that's a future enhancement. For now, it's logged and stored in database.

---

**END OF PRD**

*This document is a living document. Update as implementation reveals new requirements or edge cases.*

*Version: 1.0*
*Last Updated: 2025-10-28*
*Author: Claude Code AI Assistant*
*Approved by: [Approver Name]*
