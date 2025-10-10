// Quick test: Check SERP discovery for any keyword
import axios from "axios";
import { config } from "dotenv";

config();

const SERPER_API_KEY = process.env.SERPER_DEV_API_KEY!;

async function testKeyword(keyword: string) {
  console.log(`\n🔍 Testing keyword: "${keyword}"\n`);

  const urls = new Set<string>();
  const queries = [
    `site:instagram.com/reel ${keyword}`,
    `site:instagram.com/reel ${keyword} review`,
    `site:instagram.com/reel ${keyword} unboxing`
  ];

  for (const q of queries) {
    try {
      console.log(`Querying: "${q}"`);
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q, gl: "us", hl: "en", num: 20 },
        {
          headers: {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 12000
        }
      );

      const links = (data?.organic || [])
        .filter((r: any) => r.link?.includes('/reel/'))
        .map((r: any) => ({
          url: r.link.split('?')[0],
          title: r.title,
          snippet: r.snippet
        }));

      console.log(`✓ Found ${links.length} reels\n`);

      if (links.length > 0) {
        console.log(`Sample results:`);
        links.slice(0, 3).forEach((link: any, i: number) => {
          console.log(`  ${i + 1}. ${link.title}`);
          console.log(`     ${link.snippet?.slice(0, 100)}...`);
          console.log(`     ${link.url}\n`);
        });
      }

      links.forEach((link: any) => urls.add(link.url));
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total unique URLs: ${urls.size}`);
  console.log(`   Quality: ${urls.size >= 20 ? '✅ Good' : urls.size >= 10 ? '⚠️  Moderate' : '❌ Low'}`);

  if (urls.size < 10) {
    console.log(`\n💡 Tip: Try more generic keywords for better results`);
    console.log(`   e.g., "airpods" instead of "airpods pro 2nd gen"`);
  }
}

const keyword = process.argv.slice(2).join(" ");
if (keyword) {
  testKeyword(keyword);
} else {
  console.log("Usage: tsx test-keyword.ts <keyword>");
}
