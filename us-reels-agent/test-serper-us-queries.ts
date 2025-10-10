import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;

async function testUSQueryStrategies() {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  🧪 Testing US Query Strategies for Better Filtering');
    console.log('════════════════════════════════════════════════════════════════\n');

    const baseKeyword = 'fitness';

    const strategies = [
        {
            name: '❌ Current (No US in query)',
            query: `site:instagram.com/reel ${baseKeyword}`,
        },
        {
            name: '✅ Strategy 1: Add "United States"',
            query: `site:instagram.com/reel ${baseKeyword} United States`,
        },
        {
            name: '✅ Strategy 2: Add "US"',
            query: `site:instagram.com/reel ${baseKeyword} US`,
        },
        {
            name: '✅ Strategy 3: Add "USA"',
            query: `site:instagram.com/reel ${baseKeyword} USA`,
        },
        {
            name: '✅ Strategy 4: Add "America"',
            query: `site:instagram.com/reel ${baseKeyword} America`,
        },
        {
            name: '✅ Strategy 5: City names',
            query: `site:instagram.com/reel ${baseKeyword} (NYC OR "Los Angeles" OR Miami OR Chicago)`,
        },
        {
            name: '✅ Strategy 6: Exclude non-US',
            query: `site:instagram.com/reel ${baseKeyword} -"Hong Kong" -Vietnamese -Chinese`,
        }
    ];

    const results: any[] = [];

    for (const strategy of strategies) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`📋 ${strategy.name}`);
        console.log(`🔍 Query: "${strategy.query}"`);
        console.log(`${'─'.repeat(70)}`);

        try {
            const payload = {
                q: strategy.query,
                gl: 'us',
                hl: 'en',
                location: 'United States',
                num: 10
            };

            const { data } = await axios.post('https://google.serper.dev/search', payload, {
                headers: {
                    'X-API-KEY': SERPER_API_KEY!,
                    'Content-Type': 'application/json'
                }
            });

            const organic = data.organic || [];
            console.log(`✅ Results: ${organic.length}\n`);

            // Analyze language/location patterns
            let usLikely = 0;
            let nonUsLikely = 0;
            let unclear = 0;

            organic.slice(0, 5).forEach((item: any, i: number) => {
                const text = `${item.title} ${item.snippet}`.toLowerCase();

                // Detect non-English/non-US indicators
                const hasVietnamese = /punya|badan|dengan|yang|vào|tập|khôm/i.test(text);
                const hasChinese = /[\u4e00-\u9fff]/.test(text);
                const hasNonUSLocation = /hong kong|singapore|vietnam|china|malaysia|taiwan/i.test(text);

                // Detect US indicators
                const hasUSLocation = /\b(nyc|new york|los angeles|la|chicago|miami|boston|texas|california|usa|united states)\b/i.test(text);
                const hasUSEnglish = /\b(workout|fitness|gym|trainer|coach)\b/i.test(text) &&
                                    !hasVietnamese && !hasChinese;

                let likelihood = '🤷 Unclear';
                if (hasVietnamese || hasChinese || hasNonUSLocation) {
                    likelihood = '🌏 Non-US';
                    nonUsLikely++;
                } else if (hasUSLocation || (hasUSEnglish && !hasNonUSLocation)) {
                    likelihood = '🇺🇸 US';
                    usLikely++;
                } else {
                    unclear++;
                }

                console.log(`${i + 1}. ${likelihood}`);
                console.log(`   Title: ${item.title?.substring(0, 70)}...`);
                console.log(`   URL: ${item.link}`);
                console.log(`   Snippet: ${(item.snippet || '').substring(0, 80)}...\n`);
            });

            results.push({
                strategy: strategy.name,
                query: strategy.query,
                total: organic.length,
                us_likely: usLikely,
                non_us_likely: nonUsLikely,
                unclear: unclear,
                us_percentage: organic.length > 0 ? ((usLikely / Math.min(organic.length, 5)) * 100).toFixed(0) : 0
            });

            console.log(`📊 Quick Analysis (first 5 results):`);
            console.log(`   🇺🇸 US-likely: ${usLikely}`);
            console.log(`   🌏 Non-US-likely: ${nonUsLikely}`);
            console.log(`   🤷 Unclear: ${unclear}`);

            // Wait between requests to avoid rate limiting
            await new Promise(r => setTimeout(r, 2000));

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
            results.push({
                strategy: strategy.name,
                query: strategy.query,
                error: error.message
            });
        }
    }

    // Summary comparison
    console.log('\n\n════════════════════════════════════════════════════════════════');
    console.log('  📊 STRATEGY COMPARISON');
    console.log('════════════════════════════════════════════════════════════════\n');

    console.log('Strategy                              | Total | 🇺🇸 US% | 🌏 Non-US | 🤷 Unclear');
    console.log('─'.repeat(80));

    results.forEach(r => {
        if (!r.error) {
            const name = r.strategy.substring(0, 40).padEnd(40);
            console.log(`${name} | ${String(r.total).padStart(5)} | ${String(r.us_percentage + '%').padStart(6)} | ${String(r.non_us_likely).padStart(9)} | ${String(r.unclear).padStart(10)}`);
        }
    });

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  💡 RECOMMENDATIONS');
    console.log('════════════════════════════════════════════════════════════════\n');

    const best = results
        .filter(r => !r.error)
        .sort((a, b) => Number(b.us_percentage) - Number(a.us_percentage))[0];

    if (best) {
        console.log(`🏆 Best Strategy: ${best.strategy}`);
        console.log(`   Query: "${best.query}"`);
        console.log(`   US-likely content: ${best.us_percentage}%`);
        console.log('');
        console.log('   Implementation:');
        console.log('   Update src/providers/serper.ts to append location keywords:');
        console.log('   const enhanced = `${q} United States`;');
    }

    console.log('\n📌 Key Insights:');
    console.log('   • Serper gl/hl/location params affect RANKING, not filtering');
    console.log('   • Adding "United States", "US", "USA" to QUERY TEXT filters content');
    console.log('   • City names (NYC, LA) can help but are limiting');
    console.log('   • Negative keywords (-"Hong Kong") help but not foolproof');
    console.log('   • BEST: Combine query enhancement + post-fetch profile filtering');
}

testUSQueryStrategies()
    .then(() => console.log('\n✅ Test complete\n'))
    .catch(err => console.error('❌ Error:', err));
