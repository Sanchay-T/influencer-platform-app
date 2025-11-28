/**
 * ScrapeCreators API Client
 * Shared utilities for making API calls to ScrapeCreators
 */

export class ScrapeCreatorsClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.scrapecreators.com/v1/instagram/reels/search';
  }

  /**
   * Search for Instagram reels by keyword
   * @param {string} query - Search keyword
   * @param {number} amount - Number of results to fetch (default: 10)
   * @returns {Promise<{success: boolean, reels: Array, credits_remaining: number, timing: number}>}
   */
  async searchReels(query, amount = 10) {
    const startTime = performance.now();

    const url = new URL(this.baseUrl);
    url.searchParams.set('query', query);
    url.searchParams.set('amount', amount.toString());

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const endTime = performance.now();

      return {
        ...data,
        timing: endTime - startTime,
      };
    } catch (error) {
      const endTime = performance.now();
      throw {
        error: error.message,
        timing: endTime - startTime,
      };
    }
  }

  /**
   * Batch search for multiple keywords
   * @param {Array<string>} keywords - Array of search keywords
   * @param {number} amount - Number of results per keyword
   * @returns {Promise<Array>}
   */
  async batchSearch(keywords, amount = 10) {
    return Promise.all(
      keywords.map(async (keyword) => {
        try {
          const result = await this.searchReels(keyword, amount);
          return { keyword, ...result, error: null };
        } catch (error) {
          return { keyword, error: error.error || error.message, timing: error.timing };
        }
      })
    );
  }

  /**
   * Parallel search with concurrency limit
   * @param {Array<string>} keywords - Array of search keywords
   * @param {number} amount - Number of results per keyword
   * @param {number} concurrency - Max concurrent requests
   * @returns {Promise<Array>}
   */
  async parallelSearch(keywords, amount = 10, concurrency = 3) {
    const results = [];
    const queue = [...keywords];

    const processQueue = async () => {
      while (queue.length > 0) {
        const keyword = queue.shift();
        try {
          const result = await this.searchReels(keyword, amount);
          results.push({ keyword, ...result, error: null });
        } catch (error) {
          results.push({
            keyword,
            error: error.error || error.message,
            timing: error.timing,
            success: false,
          });
        }
      }
    };

    // Start concurrent workers
    const workers = Array(concurrency).fill(null).map(() => processQueue());
    await Promise.all(workers);

    return results;
  }
}

/**
 * Calculate statistics from results
 * @param {Array} results - Array of API results
 * @returns {Object} Statistics summary
 */
export function calculateStats(results) {
  const successfulResults = results.filter(r => r.success && !r.error);
  const failedResults = results.filter(r => r.error || !r.success);

  const timings = successfulResults.map(r => r.timing);
  const totalReels = successfulResults.reduce((sum, r) => sum + (r.reels?.length || 0), 0);

  return {
    total: results.length,
    successful: successfulResults.length,
    failed: failedResults.length,
    successRate: results.length > 0 ? (successfulResults.length / results.length * 100).toFixed(2) : 0,
    timing: {
      min: timings.length > 0 ? Math.min(...timings).toFixed(2) : 0,
      max: timings.length > 0 ? Math.max(...timings).toFixed(2) : 0,
      avg: timings.length > 0 ? (timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(2) : 0,
      median: timings.length > 0 ? calculateMedian(timings).toFixed(2) : 0,
    },
    reels: {
      total: totalReels,
      avgPerRequest: successfulResults.length > 0 ? (totalReels / successfulResults.length).toFixed(2) : 0,
    },
    creditsRemaining: successfulResults.length > 0 ? successfulResults[0].credits_remaining : 'N/A',
  };
}

function calculateMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Format timestamp for reports
 */
export function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Sleep utility for rate limiting
 * @param {number} ms - Milliseconds to sleep
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
