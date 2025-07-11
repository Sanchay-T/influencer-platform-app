(async () => {
  require('dotenv').config({ path: '.env.local' });
  const { default: fetch } = await import('node-fetch');
  const fs = require('fs');
  const path = require('path');
  const ENSEMBLE_API_KEY = process.env.ENSEMBLE_API_KEY;
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN; // Assume user adds this if needed

  async function fetchEnsemblePosts(keyword, depth = 1, oldestTimestamp = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60) {
    const endpoint = 'https://ensembledata.com/apis/instagram/hashtag/posts';
    const params = new URLSearchParams({ name: keyword, depth: depth.toString(), oldest_timestamp: oldestTimestamp.toString(), token: ENSEMBLE_API_KEY });
    try {
      const response = await fetch(`${endpoint}?${params}`);
      if (!response.ok) throw new Error(`Ensemble API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Ensemble fetch error:', error);
      return [];
    }
  }

  async function fetchApifyPosts(keyword, limit = 10) {
    if (!APIFY_API_TOKEN) {
      console.error('APIFY_API_TOKEN not set in .env.local');
      return [];
    }
    const actorId = 'apify/instagram-hashtag-scraper';
    const input = {
      hashtags: [keyword],
      resultsLimit: limit
    };
    const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    if (!runResponse.ok) {
      console.error(`Apify run start failed: ${runResponse.status}`);
      return [];
    }
    const run = await runResponse.json();
    const runId = run.data.id;

    // Poll for completion
    let statusResponse;
    let attempts = 0;
    while (attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
      const status = await statusResponse.json();
      if (status.data.status === 'SUCCEEDED') break;
      if (status.data.status === 'FAILED') {
        console.error('Apify run failed');
        return [];
      }
      attempts++;
    }
    if (!statusResponse || attempts >= 10) {
      console.error('Apify run timeout or 404');
      return [];
    }

    const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${run.data.defaultDatasetId}/items?token=${APIFY_API_TOKEN}`);
    if (!datasetResponse.ok) {
      console.error(`Apify dataset fetch failed: ${datasetResponse.status}`);
      return [];
    }
    return await datasetResponse.json();
  }

  function filterPosts(posts, keyword, minLikes = 100) {
    return posts ? posts.filter(post => post.edge_liked_by?.count > minLikes && post.edge_media_to_caption?.edges[0]?.node.text.toLowerCase().includes(keyword.toLowerCase())) : [];
  }

  function saveResults(results, apiName, keyword) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logDir = path.join('logs', 'api-raw', 'keyword');
    fs.mkdirSync(logDir, { recursive: true });
    const filePath = path.join(logDir, `${apiName}-${keyword}-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
    console.log(`${apiName} results saved to ${filePath}`);
    return filePath;
  }

  async function compareResults(ensembleResults, apifyResults, keyword) {
    const ensembleFiltered = filterPosts(ensembleResults?.data, keyword);
    const apifyFiltered = filterPosts(apifyResults, keyword);
    console.log('\nComparison Summary:');
    console.log(`- Ensemble: ${ensembleFiltered.length} filtered posts (raw: ${ensembleResults?.data?.length || 0})`);
    console.log(`- Apify: ${apifyFiltered.length} filtered posts (raw: ${apifyResults?.length || 0})`);
    console.log('Sample Ensemble Post:', ensembleFiltered[0] || 'None');
    console.log('Sample Apify Post:', apifyFiltered[0] || 'None');
    // Simple spam perception: higher if many low-engagement posts
    const ensembleSpamScore = (ensembleResults?.data?.length - ensembleFiltered.length) / (ensembleResults?.data?.length || 1);
    const apifySpamScore = (apifyResults?.length - apifyFiltered.length) / (apifyResults?.length || 1);
    console.log(`Perceived Spam (higher = more filtered out): Ensemble ${ensembleSpamScore.toFixed(2)}, Apify ${apifySpamScore.toFixed(2)}`);
  }

  // New analysis functions
  async function analyzeResults(results, keyword) {
    let totalPosts = results.length;
    let keywordMatches = 0;
    let totalEngagement = 0;
    let spamCount = 0;

    results.forEach(post => {
      const caption = post.caption || post.text || '';
      if (caption.toLowerCase().includes(keyword.toLowerCase())) keywordMatches++;
      const engagement = (post.likes || 0) + (post.comments || 0);
      totalEngagement += engagement;
      const hashtagCount = (caption.match(/#/g) || []).length;
      if (hashtagCount > 5 || caption.length < 20) spamCount++;
    });

    const matchPercent = (keywordMatches / totalPosts * 100).toFixed(2);
    const avgEngagement = (totalEngagement / totalPosts).toFixed(2);
    const spamPercent = (spamCount / totalPosts * 100).toFixed(2);
    const quality = (parseFloat(matchPercent) > 70 && parseFloat(spamPercent) < 30) ? 'High' : 'Medium/Low';

    return { matchPercent, avgEngagement, spamPercent, quality };
  }

  async function main() {
    const keyword = 'redbull';
    console.log(`Comparing Instagram keyword search for '${keyword}'...`);
    let ensembleResults = [];
    if (!ENSEMBLE_API_KEY) {
      console.warn('ENSEMBLE_API_KEY not set - skipping EnsembleData');
    } else {
      try {
        ensembleResults = await fetchEnsemblePosts(keyword);
      } catch (error) {
        console.log('Inside Ensemble catch');
        console.error(`Ensemble fetch error: ${error.message}`);
        ensembleResults = [];
      }
    }
    console.log('After Ensemble try-catch, results:', ensembleResults ? ensembleResults.length : 'null/undefined');
    let apifyResults = [];
    try {
      apifyResults = await fetchApifyPosts(keyword);
    } catch (error) {
      console.error(`Apify fetch error: ${error.message}`);
      apifyResults = [];
    }
    console.log('Apify results:', apifyResults ? apifyResults.length : 'null/undefined');

    const ensembleAnalysis = await analyzeResults(ensembleResults, keyword);
    const apifyAnalysis = await analyzeResults(apifyResults, keyword);

    console.log('\nEnsembleData Analysis:', ensembleAnalysis);
    console.log('Apify Analysis:', apifyAnalysis);

    // Save with analysis
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0] + 'Z';
    const ensembleFile = path.join('logs/api-raw/keyword/', `ensemble-${keyword}-${timestamp}.json`);
    fs.writeFileSync(ensembleFile, JSON.stringify({ results: ensembleResults, analysis: ensembleAnalysis }, null, 2));

    const apifyFile = path.join('logs/api-raw/keyword/', `apify-${keyword}-${timestamp}.json`);
    fs.writeFileSync(apifyFile, JSON.stringify({ results: apifyResults, analysis: apifyAnalysis }, null, 2));

    saveResults(ensembleResults, 'ensemble', keyword);
    saveResults(apifyResults, 'apify', keyword);
    await compareResults(ensembleResults, apifyResults, keyword);
  }

  await main();
})().catch(console.error); 