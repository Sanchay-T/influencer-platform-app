/**
 * Test with real Instagram/TikTok CDN URL patterns
 */

async function testRealImages() {
  console.log('Testing with REAL CDN URL patterns...');
  console.log('');

  // Test URLs that match real Instagram/TikTok patterns
  const testUrls = [
    {
      name: 'Instagram Profile Pic (scontent)',
      url: 'https://scontent.cdninstagram.com/v/t51.2885-19/44884218_345707102882519_2446069589734326272_n.jpg'
    },
    {
      name: 'Instagram Image (fbcdn)',
      url: 'https://instagram.fmaa2-1.fna.fbcdn.net/v/t51.2885-15/123456.jpg'
    },
    {
      name: 'TikTok p16 CDN',
      url: 'https://p16-sign-sg.tiktokcdn.com/aweme/720x720/tos-alisg-avt-0068/123.jpeg'
    },
    {
      name: 'TikTok p77 CDN',
      url: 'https://p77-sign-va.tiktokcdn.com/tos-maliva-avt-0068/123.webp'
    }
  ];

  for (const test of testUrls) {
    console.log('Testing: ' + test.name);
    const proxyUrl = 'http://localhost:3002/api/proxy/image?url=' + encodeURIComponent(test.url);

    try {
      const start = Date.now();
      const response = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(10000)
      });
      const duration = Date.now() - start;

      const contentType = response.headers.get('content-type') || 'unknown';
      const isSvg = contentType.includes('svg');

      console.log('  Status: ' + response.status);
      console.log('  Content-Type: ' + contentType);
      console.log('  Duration: ' + duration + 'ms');

      if (response.ok && !isSvg) {
        console.log('  Result: ✅ Real image returned');
      } else if (isSvg) {
        console.log('  Result: ⚠️  SVG placeholder (image fetch failed)');
        console.log('  → This is what users see as "broken" image');
      } else {
        console.log('  Result: ❌ Error status ' + response.status);
      }
    } catch (e) {
      console.log('  Result: ❌ ' + e.message);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('WHAT THIS MEANS FOR USERS:');
  console.log('='.repeat(60));
  console.log('');
  console.log('When your proxy returns SVG placeholder:');
  console.log('  1. The original CDN URL failed (expired, blocked, etc.)');
  console.log('  2. Proxy generates a gray placeholder SVG');
  console.log('  3. But your frontend code does: img.style.display="none"');
  console.log('  4. So users see BLANK SPACE instead of the placeholder!');
  console.log('');
  console.log('The SVG placeholder IS being returned, but hidden by JS.');
  console.log('');
}

testRealImages().catch(console.error);
