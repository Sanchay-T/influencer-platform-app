import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;

async function testSerperUSFiltering() {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  🧪 Testing Serper US Location Filtering');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`🔑 API Key: ${SERPER_API_KEY?.substring(0, 10)}...`);
    console.log('');

    const queries = [
        {
            name: 'Fitness (with US params)',
            payload: {
                q: 'site:instagram.com/reel fitness',
                gl: 'us',
                hl: 'en',
                location: 'United States',
                num: 10
            }
        },
        {
            name: 'Fitness (no location params)',
            payload: {
                q: 'site:instagram.com/reel fitness',
                num: 10
            }
        }
    ];

    for (const test of queries) {
        console.log(`\n┌─ 🔍 Test: ${test.name}`);
        console.log(`│  📦 Payload:`, JSON.stringify(test.payload, null, 2).split('\n').join('\n│     '));

        try {
            const { data } = await axios.post('https://google.serper.dev/search', test.payload, {
                headers: {
                    'X-API-KEY': SERPER_API_KEY!,
                    'Content-Type': 'application/json'
                }
            });

            const organic = data.organic || [];
            console.log(`│  ✅ Results: ${organic.length}`);
            console.log(`│`);

            // Sample first 3 results
            organic.slice(0, 3).forEach((item: any, i: number) => {
                console.log(`│  ${i + 1}. ${item.title || 'No title'}`);
                console.log(`│     URL: ${item.link}`);
                console.log(`│     Snippet: ${(item.snippet || '').substring(0, 80)}...`);

                // Try to detect language/location hints
                const text = `${item.title} ${item.snippet}`.toLowerCase();
                const hasNonEnglish = /[\u0080-\uFFFF]/.test(text);
                const hasIndonesian = /punya|badan|dengan|yang/i.test(text);
                const hasSpanish = /el |la |con |para /i.test(text);
                const hasChinese = /[\u4e00-\u9fff]/.test(text);

                if (hasNonEnglish || hasIndonesian || hasSpanish || hasChinese) {
                    console.log(`│     ⚠️  Possible non-US content detected`);
                }
                console.log(`│`);
            });

            console.log(`└─ Done\n`);

            // Wait between requests
            await new Promise(r => setTimeout(r, 2000));

        } catch (error: any) {
            console.log(`│  ❌ Error: ${error.message}`);
            console.log(`└─ Failed\n`);
        }
    }

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  📋 Analysis');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('Serper gl/hl/location parameters affect RANKING, not filtering.');
    console.log('Instagram content is global - creators can be from anywhere.');
    console.log('');
    console.log('Solution: We must filter by creator location AFTER fetching,');
    console.log('not rely on Serper to only return US creators.');
}

testSerperUSFiltering()
    .then(() => console.log('✅ Test complete\n'))
    .catch(err => console.error('❌ Error:', err));
