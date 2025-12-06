import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * Dynamic API Limits Calculator
 * Based on real unit economics data from testing
 */

/**
 * Platform efficiency data from actual testing
 * Format: { creatorsPerCall, maxReasonableCalls }
 */
const PLATFORM_EFFICIENCY = {
  // Based on real test data
  'TikTok_keyword': { creatorsPerCall: 25, maxCalls: Infinity },
  'Instagram_reels': { creatorsPerCall: 37, maxCalls: Infinity },
  'TikTok_similar': { creatorsPerCall: 10, maxCalls: Infinity }, // Capped due to inefficiency
  'YouTube_keyword': { creatorsPerCall: 20, maxCalls: Infinity },

  // Estimated based on similar platforms (to be updated with real data)
  'Instagram_similar': { creatorsPerCall: 35, maxCalls: Infinity }, // Similar to reels but single API call
  'YouTube_similar': { creatorsPerCall: 15, maxCalls: Infinity }   // Lower efficiency due to deduplication
};

/**
 * Calculate optimal number of API calls needed
 * @param {number} targetResults - Target number of creators from frontend slider
 * @param {string} platform - Platform name (TikTok, Instagram, YouTube)
 * @param {string} searchType - Search type (keyword, similar, reels)
 * @param {string} mode - Environment mode (development, production)
 * @returns {number} Number of API calls to make
 */
export function calculateApiCallLimit(targetResults, platform, searchType, mode = process.env.API_MODE) {
  structuredConsole.log(`🔢 [API-LIMITS] Calculating for: ${platform}_${searchType}, target: ${targetResults}, mode: ${mode}`);

  // Development mode: Always 1 call for testing
  if (mode === 'development') {
    structuredConsole.log(`🔧 [API-LIMITS] Development mode: returning 1 call`);
    return 1;
  }

  // Production mode: Calculate based on efficiency
  const key = `${platform}_${searchType}`;
  const efficiency = PLATFORM_EFFICIENCY[key];

  if (!efficiency) {
    structuredConsole.warn(`⚠️ [API-LIMITS] Unknown platform combination: ${key}`);
    // Conservative fallback: assume 20 creators per call, no max
    const fallbackCalls = Math.ceil(targetResults / 20);
    structuredConsole.log(`🔧 [API-LIMITS] Using fallback: ${fallbackCalls} calls`);
    return fallbackCalls;
  }

  // Calculate calls needed based on efficiency
  const calculatedCalls = Math.ceil(targetResults / efficiency.creatorsPerCall);
  const finalCalls = Math.min(calculatedCalls, efficiency.maxCalls);

  structuredConsole.log(`🔢 [API-LIMITS] ${key}: ${targetResults} creators → ${calculatedCalls} calculated → ${finalCalls} final (max: ${efficiency.maxCalls})`);

  return finalCalls;
}

/**
 * Get estimated results for a given number of API calls
 * @param {number} apiCalls - Number of API calls
 * @param {string} platform - Platform name
 * @param {string} searchType - Search type
 * @returns {number} Estimated number of creators
 */
export function estimateResults(apiCalls, platform, searchType) {
  const key = `${platform}_${searchType}`;
  const efficiency = PLATFORM_EFFICIENCY[key];

  if (!efficiency) {
    return apiCalls * 20; // Fallback estimate
  }

  return apiCalls * efficiency.creatorsPerCall;
}

/**
 * Get platform efficiency info for debugging
 * @param {string} platform - Platform name
 * @param {string} searchType - Search type
 * @returns {object} Efficiency data
 */
export function getPlatformEfficiency(platform, searchType) {
  const key = `${platform}_${searchType}`;
  return PLATFORM_EFFICIENCY[key] || null;
}

/**
 * Check if target is achievable within reasonable limits
 * @param {number} targetResults - Target number of creators
 * @param {string} platform - Platform name
 * @param {string} searchType - Search type
 * @returns {object} Analysis of achievability
 */
export function analyzeTargetFeasibility(targetResults, platform, searchType) {
  const efficiency = getPlatformEfficiency(platform, searchType);

  if (!efficiency) {
    return {
      achievable: false,
      reason: 'Unknown platform combination',
      recommendation: 'Use a supported platform/search type'
    };
  }

  const requiredCalls = Math.ceil(targetResults / efficiency.creatorsPerCall);
  const achievable = requiredCalls <= efficiency.maxCalls;
  const maxAchievable = efficiency.maxCalls * efficiency.creatorsPerCall;

  return {
    achievable,
    requiredCalls,
    maxCalls: efficiency.maxCalls,
    maxAchievableResults: maxAchievable,
    reason: achievable ? 'Target is achievable' : `Would require ${requiredCalls} calls (max: ${efficiency.maxCalls})`,
    recommendation: achievable ? 'Proceed with calculated limits' : `Consider reducing target to ${maxAchievable} creators or using a different search type`
  };
}

// Export efficiency data for external use
export { PLATFORM_EFFICIENCY };