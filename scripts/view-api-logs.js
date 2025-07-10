/**
 * Simple script to view API logs after running searches
 * Run this after doing your 6 searches to see the raw requests/responses
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), 'logs/api-raw');

console.log('\n📁 API Raw Logs Viewer');
console.log('=====================\n');

// Check if logs directory exists
if (!fs.existsSync(logsDir)) {
  console.log('❌ No logs found. Run some searches first!\n');
  console.log('Directory expected at:', logsDir);
  return;
}

// Check keyword searches
const keywordDir = path.join(logsDir, 'keyword');
if (fs.existsSync(keywordDir)) {
  const keywordFiles = fs.readdirSync(keywordDir).filter(f => f.endsWith('.json'));
  console.log(`📂 Keyword Searches: ${keywordFiles.length} logs found`);
  
  keywordFiles.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(keywordDir, file), 'utf8'));
    console.log(`\n  📄 ${file}`);
    console.log(`     Platform: ${data.platform}`);
    console.log(`     Time: ${data.timestamp}`);
    console.log(`     Request Keywords: ${JSON.stringify(data.request.keywords)}`);
    console.log(`     Response Items: ${data.response?.search_item_list?.length || data.response?.videos?.length || 0}`);
  });
}

// Check similar searches  
const similarDir = path.join(logsDir, 'similar');
if (fs.existsSync(similarDir)) {
  const similarFiles = fs.readdirSync(similarDir).filter(f => f.endsWith('.json'));
  console.log(`\n📂 Similar Searches: ${similarFiles.length} logs found`);
  
  similarFiles.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(similarDir, file), 'utf8'));
    console.log(`\n  📄 ${file}`);
    console.log(`     Platform: ${data.platform}`);
    console.log(`     Time: ${data.timestamp}`);
    console.log(`     Request Username: ${data.request.username || data.request.handle}`);
    console.log(`     Response Type: ${data.response?.user ? 'Profile Data' : 'Search Results'}`);
  });
}

console.log('\n\n💡 To view full JSON data, open files at:');
console.log(`   ${logsDir}/keyword/`);
console.log(`   ${logsDir}/similar/\n`);