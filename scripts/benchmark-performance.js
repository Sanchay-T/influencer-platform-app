/**
 * Performance Benchmark Script
 * 
 * This script simulates user interactions and measures performance
 * Run with: node scripts/benchmark-performance.js
 */

const { performance } = require('perf_hooks');

// Simulate localStorage operations (like our caching)
function simulateLocalStorageRead() {
  const start = performance.now();
  
  // Simulate reading from localStorage
  const mockData = {
    data: {
      currentPlan: 'free_trial',
      isTrialing: true,
      daysRemaining: 6,
      hoursRemaining: 23,
      minutesRemaining: 33,
      trialProgressPercentage: 14
    },
    timestamp: Date.now(),
    userId: 'test-user'
  };
  
  // Simulate JSON parsing
  const jsonString = JSON.stringify(mockData);
  const parsed = JSON.parse(jsonString);
  
  const end = performance.now();
  return end - start;
}

// Simulate API call delay
function simulateApiCall() {
  const start = performance.now();
  
  return new Promise((resolve) => {
    // Simulate network delay (200-800ms)
    const delay = Math.random() * 600 + 200;
    setTimeout(() => {
      const end = performance.now();
      resolve(end - start);
    }, delay);
  });
}

// Simulate component rendering delay
function simulateComponentRender() {
  const start = performance.now();
  
  // Simulate React rendering work
  let work = 0;
  for (let i = 0; i < 10000; i++) {
    work += Math.random();
  }
  
  const end = performance.now();
  return end - start;
}

async function runBenchmark() {
  console.log('🚀 Starting Performance Benchmark\n');
  
  const results = {
    cacheReads: [],
    apiCalls: [],
    componentRenders: []
  };
  
  // Test cache reads (should be very fast)
  console.log('📊 Testing cache reads...');
  for (let i = 0; i < 50; i++) {
    const duration = simulateLocalStorageRead();
    results.cacheReads.push(duration);
  }
  
  // Test API calls (should be slower)
  console.log('🌐 Testing API calls...');
  for (let i = 0; i < 10; i++) {
    const duration = await simulateApiCall();
    results.apiCalls.push(duration);
  }
  
  // Test component renders
  console.log('⚛️  Testing component renders...');
  for (let i = 0; i < 20; i++) {
    const duration = simulateComponentRender();
    results.componentRenders.push(duration);
  }
  
  // Calculate statistics
  function getStats(array) {
    const sorted = [...array].sort((a, b) => a - b);
    return {
      min: Math.min(...array),
      max: Math.max(...array),
      avg: array.reduce((sum, val) => sum + val, 0) / array.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }
  
  console.log('\n📈 Benchmark Results:');
  console.log('====================\n');
  
  // Cache performance
  const cacheStats = getStats(results.cacheReads);
  console.log('💾 Cache Read Performance:');
  console.log(`   Average: ${cacheStats.avg.toFixed(3)}ms`);
  console.log(`   Median:  ${cacheStats.median.toFixed(3)}ms`);
  console.log(`   Min/Max: ${cacheStats.min.toFixed(3)}ms / ${cacheStats.max.toFixed(3)}ms`);
  console.log(`   95th %:  ${cacheStats.p95.toFixed(3)}ms`);
  
  // API performance
  const apiStats = getStats(results.apiCalls);
  console.log('\n🌐 API Call Performance:');
  console.log(`   Average: ${apiStats.avg.toFixed(1)}ms`);
  console.log(`   Median:  ${apiStats.median.toFixed(1)}ms`);
  console.log(`   Min/Max: ${apiStats.min.toFixed(1)}ms / ${apiStats.max.toFixed(1)}ms`);
  console.log(`   95th %:  ${apiStats.p95.toFixed(1)}ms`);
  
  // Component render performance
  const renderStats = getStats(results.componentRenders);
  console.log('\n⚛️  Component Render Performance:');
  console.log(`   Average: ${renderStats.avg.toFixed(3)}ms`);
  console.log(`   Median:  ${renderStats.median.toFixed(3)}ms`);
  console.log(`   Min/Max: ${renderStats.min.toFixed(3)}ms / ${renderStats.max.toFixed(3)}ms`);
  console.log(`   95th %:  ${renderStats.p95.toFixed(3)}ms`);
  
  // Calculate improvement metrics
  const improvementFactor = apiStats.avg / cacheStats.avg;
  console.log('\n🎯 Performance Improvements:');
  console.log(`   Cache is ${improvementFactor.toFixed(0)}x faster than API calls`);
  console.log(`   Total load time (cached):     ${(cacheStats.avg + renderStats.avg).toFixed(1)}ms`);
  console.log(`   Total load time (uncached):   ${(apiStats.avg + renderStats.avg).toFixed(1)}ms`);
  console.log(`   Time savings per load:        ${(apiStats.avg - cacheStats.avg).toFixed(1)}ms`);
  
  // User experience impact
  console.log('\n👤 User Experience Impact:');
  if (cacheStats.avg < 10) {
    console.log('   ✅ Excellent: Cache loads feel instant (<10ms)');
  } else if (cacheStats.avg < 50) {
    console.log('   ✅ Good: Cache loads feel very fast (<50ms)');
  } else {
    console.log('   ⚠️  Fair: Cache loads may have noticeable delay');
  }
  
  if (apiStats.avg < 200) {
    console.log('   ✅ Fast API: API calls complete quickly (<200ms)');
  } else if (apiStats.avg < 500) {
    console.log('   ⚠️  Moderate API: API calls have noticeable delay');
  } else {
    console.log('   ❌ Slow API: API calls feel sluggish (>500ms)');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (improvementFactor > 50) {
    console.log('   🎉 Excellent caching performance! Users will notice the difference.');
  } else if (improvementFactor > 10) {
    console.log('   👍 Good caching performance. Consider extending cache duration.');
  } else {
    console.log('   🔧 Cache performance could be improved. Check localStorage overhead.');
  }
  
  console.log('   📱 Test on mobile devices for real-world performance');
  console.log('   📊 Monitor with real user data for validation');
  
  console.log('\n🏁 Benchmark Complete!');
}

// Run the benchmark
runBenchmark().catch(console.error);