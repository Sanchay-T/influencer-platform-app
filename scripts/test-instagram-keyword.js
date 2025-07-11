// test-instagram-keyword.js
// Test script for Apify Instagram Post Scraper with keyword search

const { ApifyClient } = require('apify-client');
require('dotenv').config({ path: '.env.local' }); // Load environment variables
const fs = require('fs'); // Added for saving results to file

async function testInstagramKeywordSearch() {
  console.log('Starting Instagram keyword search test...');
  
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  
  // Update actorId and input
  const actorId = 'apify/instagram-scraper'; // Correct actor for general Instagram scraping
  
  const input = {
    search: 'redbull', // Test keyword as single string
    searchType: 'hashtag', // Use hashtag for keyword approximation
    searchLimit: 20, // Use searchLimit for this actor
    addParentData: true, // Include parent/creator details
    proxy: { useApifyProxy: true } // Use proxy to avoid blocks
  };
  
  // Run the actor
  console.log('Running Apify actor with input:', input);
  
  try {
    const run = await client.actor(actorId).call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    // Save results to a file
    fs.writeFileSync('instagram-keyword-test-results.json', JSON.stringify(items, null, 2));
    console.log('Test successful! Results saved to instagram-keyword-test-results.json');
    console.log('Sample result:', JSON.stringify(items[0], null, 2));
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testInstagramKeywordSearch(); 