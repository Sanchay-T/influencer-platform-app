// test-ensemble-instagram-keyword.js
// Test script for EnsembleData Instagram keyword search

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = require('node-fetch');

async function testEnsembleInstagramKeywordSearch() {
  console.log('Starting EnsembleData Instagram keyword search test...');
  
  const apiKey = process.env.ENSEMBLE_API_KEY;
  if (!apiKey) {
    console.error('ENSEMBLE_API_KEY not found in .env.local');
    console.log('Available env vars:', Object.keys(process.env));
    return;
  }
  
  const keyword = 'redbull'; // Test keyword
  const searchUrl = `https://ensembledata.com/apis/instagram/search?text=${keyword}&token=${apiKey}`;

  const searchResponse = await fetch(searchUrl, { method: 'GET' });
  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`Search API request failed: ${searchResponse.statusText} - ${errorText}`);
  }

  const searchData = await searchResponse.json();

  // Check for users
  if (!searchData.data || !searchData.data.users || searchData.data.users.length === 0) {
    console.log('No users found for keyword. Exiting.');
    return;
  }

  // Take first user's ID
  const userId = searchData.data.users[0].user.pk;
  console.log(`Fetching posts for user ID: ${userId}`);

  // Set oldest_timestamp to last 24 hours for recent posts
  const oldestTimestamp = Math.floor(Date.now() / 1000) - 86400;

  const postsUrl = `https://ensembledata.com/apis/instagram/user/posts?user_id=${userId}&depth=1&chunk_size=10&oldest_timestamp=${oldestTimestamp}&token=${apiKey}`;

  const postsResponse = await fetch(postsUrl, { method: 'GET' });
  if (!postsResponse.ok) {
    const errorText = await postsResponse.text();
    throw new Error(`Posts API request failed: ${postsResponse.statusText} - ${errorText}`);
  }

  const postsData = await postsResponse.json();

  // Save full results
  fs.writeFileSync('ensemble-instagram-keyword-test-results.json', JSON.stringify({ search: searchData, posts: postsData }, null, 2));
  console.log('Test successful! Full results saved to ensemble-instagram-keyword-test-results.json');

  // Log sample post if available
  if (postsData.data && postsData.data.posts && postsData.data.posts.length > 0) {
    console.log('Sample post:', JSON.stringify(postsData.data.posts[0], null, 2));
  } else {
    console.log('No recent posts found for this user.');
  }
}

// New test for hashtag posts endpoint
async function testHashtagPosts() {
  const endpoint = 'https://ensembledata.com/apis/instagram/hashtag/posts';
  const params = new URLSearchParams({
    name: 'redbull',
    depth: '1',
    oldest_timestamp: '1720800000',
    token: process.env.ENSEMBLE_API_KEY
  });

  console.log(`\nTesting Hashtag Posts: ${endpoint}?${params.toString()}`);

  try {
    const response = await fetch(`${endpoint}?${params.toString()}`);
    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `logs/api-raw/keyword/instagram-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Results saved to ${filename}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the new test
testHashtagPosts();

testEnsembleInstagramKeywordSearch(); 