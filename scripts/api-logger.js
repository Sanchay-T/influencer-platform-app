/**
 * Enhanced API Logger for All 6 Search Endpoints
 * 
 * This script provides comprehensive logging middleware to capture:
 * - Request payloads for all search endpoints
 * - Raw API responses before transformation
 * - Transformed data after processing
 * - Error states and edge cases
 * 
 * Usage: Import and use logApiCall() in each search endpoint
 */

const fs = require('fs');
const path = require('path');

/**
 * Search endpoint configuration
 */
const SEARCH_ENDPOINTS = {
  'tiktok-keyword': {
    endpoint: '/api/scraping/tiktok',
    type: 'keyword',
    platform: 'TikTok'
  },
  'tiktok-similar': {
    endpoint: '/api/scraping/tiktok-similar',
    type: 'similar',
    platform: 'TikTok'
  },
  'instagram-similar': {
    endpoint: '/api/scraping/instagram',
    type: 'similar',
    platform: 'Instagram'
  },
  'instagram-hashtag': {
    endpoint: '/api/scraping/instagram-hashtag',
    type: 'keyword',
    platform: 'Instagram'
  },
  'youtube-keyword': {
    endpoint: '/api/scraping/youtube',
    type: 'keyword',
    platform: 'YouTube'
  },
  'youtube-similar': {
    endpoint: '/api/scraping/youtube-similar',
    type: 'similar',
    platform: 'YouTube'
  }
};

/**
 * Ensure log directories exist
 */
function ensureLogDirectories() {
  const baseDir = path.join(process.cwd(), 'logs', 'api-analysis');
  const subdirs = ['requests', 'raw-responses', 'transformed', 'analysis'];
  
  subdirs.forEach(dir => {
    const fullPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${fullPath}`);
    }
  });
}

/**
 * Generate timestamp for file naming
 */
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Generate unique filename for logs
 */
function generateLogFilename(searchKey, logType, identifier = '') {
  const timestamp = getTimestamp();
  const identifierSuffix = identifier ? `-${identifier}` : '';
  return `${searchKey}-${logType}${identifierSuffix}-${timestamp}.json`;
}

/**
 * Save data to JSON file
 */
function saveToFile(data, filename, directory) {
  try {
    const filePath = path.join(process.cwd(), 'logs', 'api-analysis', directory, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${directory}/${filename}`);
    return filePath;
  } catch (error) {
    console.error(`❌ Error saving ${filename}:`, error.message);
    return null;
  }
}

/**
 * Main API logging function
 * 
 * @param {string} searchKey - Key identifying the search type (e.g., 'tiktok-keyword')
 * @param {object} requestData - Original request payload
 * @param {object} rawResponse - Raw API response before transformation
 * @param {object} transformedData - Final processed data
 * @param {object} metadata - Additional metadata (timing, errors, etc.)
 */
function logApiCall(searchKey, requestData, rawResponse, transformedData, metadata = {}) {
  ensureLogDirectories();
  
  const config = SEARCH_ENDPOINTS[searchKey];
  if (!config) {
    console.error(`❌ Unknown search key: ${searchKey}`);
    return;
  }
  
  const sessionId = metadata.sessionId || Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.log(`\n🔍 [API-LOGGER] Logging ${config.platform} ${config.type} search`);
  console.log(`📊 Session ID: ${sessionId}`);
  
  // 1. Log Request Data
  const requestLog = {
    timestamp,
    sessionId,
    searchKey,
    endpoint: config.endpoint,
    platform: config.platform,
    searchType: config.type,
    requestData: requestData,
    metadata: {
      userAgent: metadata.userAgent || 'unknown',
      userId: metadata.userId || 'unknown',
      campaignId: metadata.campaignId || 'unknown'
    }
  };
  
  const requestFile = generateLogFilename(searchKey, 'request', sessionId);
  saveToFile(requestLog, requestFile, 'requests');
  
  // 2. Log Raw Response
  const rawResponseLog = {
    timestamp,
    sessionId,
    searchKey,
    endpoint: config.endpoint,
    platform: config.platform,
    searchType: config.type,
    rawResponse: rawResponse,
    metadata: {
      responseTime: metadata.responseTime || 'unknown',
      statusCode: metadata.statusCode || 'unknown',
      apiProvider: metadata.apiProvider || 'unknown'
    }
  };
  
  const rawFile = generateLogFilename(searchKey, 'raw', sessionId);
  saveToFile(rawResponseLog, rawFile, 'raw-responses');
  
  // 3. Log Transformed Data
  const transformedLog = {
    timestamp,
    sessionId,
    searchKey,
    endpoint: config.endpoint,
    platform: config.platform,
    searchType: config.type,
    transformedData: transformedData,
    dataQuality: {
      totalResults: Array.isArray(transformedData) ? transformedData.length : 0,
      hasImages: transformedData?.some?.(item => item.creator?.avatarUrl) || false,
      hasBios: transformedData?.some?.(item => item.creator?.bio) || false,
      hasEmails: transformedData?.some?.(item => item.creator?.emails?.length > 0) || false,
      hasEngagement: transformedData?.some?.(item => item.video?.statistics) || false
    }
  };
  
  const transformedFile = generateLogFilename(searchKey, 'transformed', sessionId);
  saveToFile(transformedLog, transformedFile, 'transformed');
  
  // 4. Generate Summary
  const summaryLog = {
    timestamp,
    sessionId,
    searchKey,
    endpoint: config.endpoint,
    platform: config.platform,
    searchType: config.type,
    summary: {
      requestFields: Object.keys(requestData || {}),
      responseFields: getDeepKeys(rawResponse),
      transformedFields: getDeepKeys(transformedData),
      dataQuality: transformedLog.dataQuality,
      performance: {
        responseTime: metadata.responseTime,
        statusCode: metadata.statusCode
      }
    },
    files: {
      request: requestFile,
      rawResponse: rawFile,
      transformed: transformedFile
    }
  };
  
  const summaryFile = generateLogFilename(searchKey, 'summary', sessionId);
  saveToFile(summaryLog, summaryFile, 'analysis');
  
  console.log(`✅ [API-LOGGER] Complete log set saved for ${config.platform} ${config.type}`);
  console.log(`📂 Session: ${sessionId}`);
  
  return {
    sessionId,
    files: {
      request: requestFile,
      rawResponse: rawFile,
      transformed: transformedFile,
      summary: summaryFile
    }
  };
}

/**
 * Helper function to extract all nested keys from an object
 */
function getDeepKeys(obj, prefix = '') {
  if (!obj || typeof obj !== 'object') return [];
  
  let keys = [];
  
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      keys = keys.concat(getDeepKeys(obj[0], prefix + '[0]'));
    }
  } else {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys = keys.concat(getDeepKeys(obj[key], fullKey));
      }
    }
  }
  
  return keys;
}

/**
 * Enhanced logging function with error handling
 */
function logApiCallSafe(searchKey, requestData, rawResponse, transformedData, metadata = {}) {
  try {
    return logApiCall(searchKey, requestData, rawResponse, transformedData, metadata);
  } catch (error) {
    console.error(`❌ [API-LOGGER] Error logging ${searchKey}:`, error.message);
    
    // Save error log
    const errorLog = {
      timestamp: new Date().toISOString(),
      searchKey,
      error: error.message,
      stack: error.stack,
      requestData,
      metadata
    };
    
    const errorFile = generateLogFilename(searchKey, 'error');
    saveToFile(errorLog, errorFile, 'analysis');
    
    return { error: error.message };
  }
}

/**
 * Batch analysis function to process multiple log files
 */
function analyzeLoggedData(searchKey = null) {
  const analysisDir = path.join(process.cwd(), 'logs', 'api-analysis');
  
  if (!fs.existsSync(analysisDir)) {
    console.error('❌ No analysis directory found. Run some searches first.');
    return;
  }
  
  console.log(`🔍 Analyzing logged data${searchKey ? ` for ${searchKey}` : ''}...`);
  
  // This function will be expanded in the analysis script
  console.log('📊 Analysis function placeholder - see analyze-search-data.js');
}

module.exports = {
  logApiCall,
  logApiCallSafe,
  analyzeLoggedData,
  SEARCH_ENDPOINTS,
  ensureLogDirectories
};