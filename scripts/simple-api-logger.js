/**
 * Simple API Logger - Just logs raw request and response
 * No analysis, no transformation, just the raw data
 */

const fs = require('fs');
const path = require('path');

// Ensure directories exist
function ensureDirectories() {
  const dirs = [
    'logs/api-raw/keyword',
    'logs/api-raw/similar'
  ];
  
  dirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
}

/**
 * Simple logging function - just saves request and response
 * 
 * @param {string} platform - 'tiktok', 'instagram', or 'youtube'
 * @param {string} searchType - 'keyword' or 'similar'
 * @param {object} request - The request payload sent to API
 * @param {object} response - The raw response from API
 */
function logApiCall(platform, searchType, request, response) {
  ensureDirectories();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${platform}-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'logs/api-raw', searchType, filename);
  
  const logData = {
    timestamp: new Date().toISOString(),
    platform: platform,
    searchType: searchType,
    request: request,
    response: response
  };
  
  fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
  
  // ENHANCED LOGGING - VERY VISIBLE IN TERMINAL
  console.log('\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
  console.log('📁 RAW API DATA SAVED TO FILE - CHECK THIS IMMEDIATELY!');
  console.log(`🔥 PLATFORM: ${platform.toUpperCase()}`);
  console.log(`🔥 SEARCH TYPE: ${searchType.toUpperCase()}`);
  console.log(`🔥 FULL FILE PATH: ${filepath}`);
  console.log(`🔥 FILENAME: ${filename}`);
  console.log(`🔥 REQUEST SIZE: ${JSON.stringify(request).length} characters`);
  console.log(`🔥 RESPONSE SIZE: ${JSON.stringify(response).length} characters`);
  console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n');
}

module.exports = { logApiCall };