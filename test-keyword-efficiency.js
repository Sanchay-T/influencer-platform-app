#!/usr/bin/env node
/**
 * TEST SCRIPT: Sequential Fair Distribution Architecture
 *
 * This script simulates the NEW keyword processing logic without touching production code.
 * It compares OLD behavior (broken) vs NEW behavior (fixed) using mock data.
 */

// ============================================================================
// MOCK DATA - Simulates agent responses
// ============================================================================

const MOCK_AGENT_RESPONSES = {
  colgate: {
    attempt1: { creators: 95, cost: 0.85, duration: 150 },
    attempt2: { creators: 88, cost: 0.82, duration: 145 },
    attempt3: { creators: 91, cost: 0.83, duration: 148 },
  },
  pepsodent: {
    attempt1: { creators: 87, cost: 0.78, duration: 142 },
    attempt2: { creators: 82, cost: 0.75, duration: 138 },
    attempt3: { creators: 85, cost: 0.77, duration: 140 },
  },
  dabur: {
    attempt1: { creators: 92, cost: 0.82, duration: 146 },
    attempt2: { creators: 89, cost: 0.80, duration: 144 },
    attempt3: { creators: 90, cost: 0.81, duration: 145 },
  },
};

// Simulate deduplication (some creators appear in multiple keyword results)
const DEDUPLICATION_RATE = 0.10; // 10% duplicates

// ============================================================================
// MOCK AGENT FUNCTION
// ============================================================================

async function mockRunAgent(keyword, attemptNumber) {
  const response = MOCK_AGENT_RESPONSES[keyword][`attempt${attemptNumber}`];

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate deduplication
  const uniqueCreators = Math.floor(response.creators * (1 - DEDUPLICATION_RATE));

  return {
    keyword,
    creators: uniqueCreators,
    totalFound: response.creators,
    duplicates: response.creators - uniqueCreators,
    cost: response.cost,
    duration: response.duration,
  };
}

// ============================================================================
// OLD ARCHITECTURE (Current Broken Behavior)
// ============================================================================

async function oldArchitecture(keywords, targetTotal) {
  console.log('\n🔴 === OLD ARCHITECTURE (BROKEN) ===\n');
  console.log(`Keywords: ${JSON.stringify(keywords)}`);
  console.log(`Target: ${targetTotal} results\n`);

  let totalResults = 0;
  let totalCost = 0;
  let attemptCount = 0;
  const keywordAttempts = {};
  const timeline = [];

  // Simulate the broken behavior: alternates between first 2 keywords
  const maxAttempts = 6; // System gives up after 6 attempts

  while (attemptCount < maxAttempts && totalResults < targetTotal) {
    // BUG: Only cycles through first 2 keywords
    const keywordIndex = attemptCount % 2; // 0, 1, 0, 1, 0, 1
    const keyword = keywords[keywordIndex];

    attemptCount++;
    keywordAttempts[keyword] = (keywordAttempts[keyword] || 0) + 1;

    const result = await mockRunAgent(keyword, keywordAttempts[keyword]);

    totalResults += result.creators;
    totalCost += result.cost;

    timeline.push({
      attempt: attemptCount,
      keyword,
      attemptNum: keywordAttempts[keyword],
      found: result.creators,
      duplicates: result.duplicates,
      cumulative: totalResults,
      cost: result.cost,
    });

    console.log(`[${attemptCount}] ${keyword} (attempt #${keywordAttempts[keyword]}): +${result.creators} creators (${result.duplicates} dupes) | Total: ${totalResults}/${targetTotal} | Cost: $${result.cost}`);
  }

  // BUG: Force progress to 95% minimum
  const actualProgress = (totalResults / targetTotal) * 100;
  const reportedProgress = Math.max(actualProgress, 95);

  console.log('\n📊 OLD ARCHITECTURE RESULTS:');
  console.log(`✅ Total Results: ${totalResults}/${targetTotal} (${actualProgress.toFixed(1)}% actual)`);
  console.log(`📈 Reported Progress: ${reportedProgress.toFixed(1)}% (INFLATED! ❌)`);
  console.log(`💰 Total Cost: $${totalCost.toFixed(2)}`);
  console.log(`🔄 Agent Runs: ${attemptCount}`);
  console.log(`📋 Keywords Attempted: ${Object.keys(keywordAttempts).join(', ')}`);
  console.log(`❌ Keywords MISSED: ${keywords.filter(k => !keywordAttempts[k]).join(', ') || 'none'}`);

  Object.entries(keywordAttempts).forEach(([kw, count]) => {
    const kwResults = timeline.filter(t => t.keyword === kw).reduce((sum, t) => sum + t.found, 0);
    console.log(`   - ${kw}: ${count} attempts, ${kwResults} results`);
  });

  return {
    totalResults,
    totalCost,
    attemptCount,
    actualProgress,
    reportedProgress,
    keywordAttempts,
    timeline,
    missedKeywords: keywords.filter(k => !keywordAttempts[k]),
  };
}

// ============================================================================
// NEW ARCHITECTURE (Fixed Sequential Fair Distribution)
// ============================================================================

async function newArchitecture(keywords, targetTotal) {
  console.log('\n\n🟢 === NEW ARCHITECTURE (FIXED) ===\n');
  console.log(`Keywords: ${JSON.stringify(keywords)}`);
  console.log(`Target: ${targetTotal} results\n`);

  const targetPerKeyword = Math.ceil(targetTotal / keywords.length);
  console.log(`📊 Fair allocation: ${targetPerKeyword} results per keyword\n`);

  let totalResults = 0;
  let totalCost = 0;
  let attemptCount = 0;
  const keywordResults = new Map();
  const attemptedKeywords = new Set();
  const timeline = [];

  // PHASE 1: Process each keyword once
  console.log('🎯 PHASE 1: Initial Pass (one attempt per keyword)\n');

  for (const keyword of keywords) {
    attemptCount++;
    attemptedKeywords.add(keyword);

    const result = await mockRunAgent(keyword, 1);

    keywordResults.set(keyword, result.creators);
    totalResults += result.creators;
    totalCost += result.cost;

    timeline.push({
      phase: 1,
      attempt: attemptCount,
      keyword,
      found: result.creators,
      duplicates: result.duplicates,
      cumulative: totalResults,
      cost: result.cost,
    });

    console.log(`[${attemptCount}] ${keyword}: +${result.creators} creators (${result.duplicates} dupes) | Total: ${totalResults}/${targetTotal} | Cost: $${result.cost}`);
  }

  console.log(`\n✅ All keywords attempted: ${Array.from(attemptedKeywords).join(', ')}`);
  console.log(`📊 Current total: ${totalResults}/${targetTotal} (${((totalResults/targetTotal)*100).toFixed(1)}%)\n`);

  // PHASE 2: Refinement pass if needed
  if (totalResults < targetTotal) {
    const deficit = targetTotal - totalResults;
    console.log(`🔄 PHASE 2: Refinement Pass (need ${deficit} more results)\n`);

    // Find keyword with fewest results
    const sortedKeywords = Array.from(keywordResults.entries())
      .sort((a, b) => a[1] - b[1]);

    const [minKeyword, minCount] = sortedKeywords[0];
    console.log(`   Selecting "${minKeyword}" (currently has fewest: ${minCount})\n`);

    attemptCount++;
    const result = await mockRunAgent(minKeyword, 2);

    keywordResults.set(minKeyword, keywordResults.get(minKeyword) + result.creators);
    totalResults += result.creators;
    totalCost += result.cost;

    timeline.push({
      phase: 2,
      attempt: attemptCount,
      keyword: minKeyword,
      found: result.creators,
      duplicates: result.duplicates,
      cumulative: totalResults,
      cost: result.cost,
    });

    console.log(`[${attemptCount}] ${minKeyword} (refinement): +${result.creators} creators | Total: ${totalResults}/${targetTotal} | Cost: $${result.cost}`);
  }

  // ACCURATE progress calculation (no inflation!)
  const actualProgress = (totalResults / targetTotal) * 100;
  const reportedProgress = actualProgress; // Same as actual - no lies!

  console.log('\n📊 NEW ARCHITECTURE RESULTS:');
  console.log(`✅ Total Results: ${totalResults}/${targetTotal} (${actualProgress.toFixed(1)}%)`);
  console.log(`📈 Reported Progress: ${reportedProgress.toFixed(1)}% (ACCURATE! ✅)`);
  console.log(`💰 Total Cost: $${totalCost.toFixed(2)}`);
  console.log(`🔄 Agent Runs: ${attemptCount}`);
  console.log(`📋 Keywords Processed: ${Array.from(attemptedKeywords).join(', ')}`);
  console.log(`✅ Keywords MISSED: ${keywords.filter(k => !attemptedKeywords.has(k)).length === 0 ? 'NONE! 🎉' : keywords.filter(k => !attemptedKeywords.has(k)).join(', ')}`);

  console.log('\n📊 Per-Keyword Breakdown:');
  Array.from(keywordResults.entries()).forEach(([kw, count]) => {
    const percentage = ((count / totalResults) * 100).toFixed(1);
    console.log(`   - ${kw}: ${count} results (${percentage}%)`);
  });

  return {
    totalResults,
    totalCost,
    attemptCount,
    actualProgress,
    reportedProgress,
    keywordResults: Object.fromEntries(keywordResults),
    timeline,
    missedKeywords: [],
  };
}

// ============================================================================
// COMPARISON & ANALYSIS
// ============================================================================

function compareResults(oldResult, newResult) {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SIDE-BY-SIDE COMPARISON');
  console.log('='.repeat(80) + '\n');

  const metrics = [
    {
      name: 'Results Collected',
      old: `${oldResult.totalResults}/300`,
      new: `${newResult.totalResults}/300`,
      improvement: newResult.totalResults - oldResult.totalResults,
    },
    {
      name: 'Actual Progress',
      old: `${oldResult.actualProgress.toFixed(1)}%`,
      new: `${newResult.actualProgress.toFixed(1)}%`,
      improvement: `+${(newResult.actualProgress - oldResult.actualProgress).toFixed(1)}%`,
    },
    {
      name: 'Reported Progress',
      old: `${oldResult.reportedProgress.toFixed(1)}% (inflated)`,
      new: `${newResult.reportedProgress.toFixed(1)}% (accurate)`,
      improvement: 'Honest reporting',
    },
    {
      name: 'Total Cost',
      old: `$${oldResult.totalCost.toFixed(2)}`,
      new: `$${newResult.totalCost.toFixed(2)}`,
      improvement: `$${(oldResult.totalCost - newResult.totalCost).toFixed(2)} saved`,
    },
    {
      name: 'Cost per Creator',
      old: `$${(oldResult.totalCost / oldResult.totalResults).toFixed(4)}`,
      new: `$${(newResult.totalCost / newResult.totalResults).toFixed(4)}`,
      improvement: `${(((oldResult.totalCost / oldResult.totalResults) / (newResult.totalCost / newResult.totalResults)) * 100 - 100).toFixed(0)}% worse in old`,
    },
    {
      name: 'Agent Runs',
      old: `${oldResult.attemptCount}`,
      new: `${newResult.attemptCount}`,
      improvement: `${oldResult.attemptCount - newResult.attemptCount} fewer runs`,
    },
    {
      name: 'Keywords Processed',
      old: `${Object.keys(oldResult.keywordAttempts).length}/3`,
      new: `${Object.keys(newResult.keywordResults).length}/3`,
      improvement: newResult.missedKeywords.length === 0 ? '100% coverage ✅' : 'Incomplete',
    },
    {
      name: 'Missed Keywords',
      old: oldResult.missedKeywords.length > 0 ? oldResult.missedKeywords.join(', ') : 'none',
      new: newResult.missedKeywords.length > 0 ? newResult.missedKeywords.join(', ') : 'NONE ✅',
      improvement: oldResult.missedKeywords.length - newResult.missedKeywords.length > 0 ? 'Fixed!' : 'Same',
    },
  ];

  console.log('┌' + '─'.repeat(78) + '┐');
  console.log('│ Metric                      │ Old (Broken)    │ New (Fixed)     │ Improvement      │');
  console.log('├' + '─'.repeat(78) + '┤');

  metrics.forEach(m => {
    const name = m.name.padEnd(27);
    const old = String(m.old).padEnd(15);
    const _new = String(m.new).padEnd(15);
    const imp = String(m.improvement).padEnd(16);
    console.log(`│ ${name} │ ${old} │ ${_new} │ ${imp} │`);
  });

  console.log('└' + '─'.repeat(78) + '┘\n');

  // Summary
  console.log('🎯 KEY IMPROVEMENTS:\n');

  const improvements = [];

  if (newResult.missedKeywords.length === 0 && oldResult.missedKeywords.length > 0) {
    improvements.push(`✅ FIXED: All ${Object.keys(newResult.keywordResults).length} keywords processed (old missed: ${oldResult.missedKeywords.join(', ')})`);
  }

  if (newResult.totalResults > oldResult.totalResults) {
    const pctIncrease = ((newResult.totalResults / oldResult.totalResults - 1) * 100).toFixed(0);
    improvements.push(`✅ ${pctIncrease}% more results collected (${newResult.totalResults} vs ${oldResult.totalResults})`);
  }

  if (newResult.totalCost < oldResult.totalCost) {
    const savings = oldResult.totalCost - newResult.totalCost;
    const pctSavings = ((savings / oldResult.totalCost) * 100).toFixed(0);
    improvements.push(`✅ ${pctSavings}% cost reduction ($${savings.toFixed(2)} saved)`);
  }

  if (newResult.attemptCount < oldResult.attemptCount) {
    improvements.push(`✅ ${oldResult.attemptCount - newResult.attemptCount} fewer agent runs (${newResult.attemptCount} vs ${oldResult.attemptCount})`);
  }

  const oldCostPerCreator = oldResult.totalCost / oldResult.totalResults;
  const newCostPerCreator = newResult.totalCost / newResult.totalResults;
  const efficiencyGain = ((oldCostPerCreator / newCostPerCreator - 1) * 100).toFixed(0);
  improvements.push(`✅ ${efficiencyGain}% better cost efficiency ($${newCostPerCreator.toFixed(4)} vs $${oldCostPerCreator.toFixed(4)} per creator)`);

  improvements.push(`✅ Accurate progress reporting (no more inflated 95%)`);

  improvements.forEach((imp, idx) => {
    console.log(`${idx + 1}. ${imp}`);
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTest() {
  console.log('\n' + '█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + '  🧪 KEYWORD EFFICIENCY TEST: Old vs New Architecture'.padEnd(78) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80));

  const keywords = ['colgate', 'pepsodent', 'dabur'];
  const targetTotal = 300;

  console.log('\n📋 TEST CONFIGURATION:');
  console.log(`   Keywords: ${JSON.stringify(keywords)}`);
  console.log(`   Target Results: ${targetTotal}`);
  console.log(`   Deduplication Rate: ${(DEDUPLICATION_RATE * 100).toFixed(0)}%`);

  // Run OLD architecture
  const oldResult = await oldArchitecture(keywords, targetTotal);

  // Run NEW architecture
  const newResult = await newArchitecture(keywords, targetTotal);

  // Compare results
  compareResults(oldResult, newResult);

  console.log('✅ TEST COMPLETE!\n');
  console.log('👉 If these results look good, we can integrate into the actual codebase.\n');
}

// ============================================================================
// RUN THE TEST
// ============================================================================

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
