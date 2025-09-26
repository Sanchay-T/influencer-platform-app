#!/usr/bin/env node
// Extracts top 5 items from a saved job status JSON file and prints a concise summary.
// Usage: node test-scripts/extract-top5.js logs/tiktok_keyword_iphone17pro.json

const fs = require('fs')
const path = require('path')

function summarizeItem(item) {
  // Attempt to normalize across platforms
  const creator = item.creator || item.channel || item.profile || {}
  const video = item.video || item.post || {}
  const name = creator.name || creator.full_name || item.name || item.title || 'Unknown'
  const username = creator.uniqueId || creator.username || creator.channelId || item.username || null
  const platform = item.platform || (username ? (username.includes('@') ? 'Instagram' : null) : null)
  const url = video.url || item.url || null
  const followers = creator.followers || creator.followerCount || null
  const views = (video.statistics && (video.statistics.views || video.statistics.viewCount)) || item.viewCount || null

  return { name, username, platform, url, followers, views }
}

function extractTop5(data) {
  if (!data || !Array.isArray(data.results)) return []
  let items = []
  // If results contain creators array inside each result, flatten them
  for (const r of data.results) {
    if (Array.isArray(r.creators)) {
      for (const c of r.creators) items.push(c)
    } else if (r && typeof r === 'object') {
      items.push(r)
    }
  }
  items = items.filter(Boolean)
  return items.slice(0, 5).map(summarizeItem)
}

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node test-scripts/extract-top5.js <json-file>')
    process.exit(1)
  }
  const text = fs.readFileSync(file, 'utf8')
  const json = JSON.parse(text)
  const top5 = extractTop5(json)
  console.log(JSON.stringify({ file, status: json.status, count: top5.length, top5 }, null, 2))
}

main()

