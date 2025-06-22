import { NextResponse } from 'next/server';
import sharp from 'sharp';
import convert from 'heic-convert';

export async function GET(request: Request) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    console.log('🖼️ [IMAGE-PROXY] Starting image proxy request');
    console.log('🔗 [IMAGE-PROXY] Source URL:', imageUrl);
    console.log('🕐 [IMAGE-PROXY] Timestamp:', new Date().toISOString());

    if (!imageUrl) {
      console.error('❌ [IMAGE-PROXY] Missing image URL parameter');
      return new NextResponse('Missing image URL', { status: 400 });
    }

    // Detect image format from URL
    const isHeic = imageUrl.toLowerCase().includes('.heic') || imageUrl.toLowerCase().includes('.heif');
    console.log('🔍 [IMAGE-PROXY] Detected format:', isHeic ? 'HEIC/HEIF' : 'Other');

    console.log('📡 [IMAGE-PROXY] Fetching image from source...');
    
    // Enhanced headers to bypass CDN restrictions
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // Add specific headers for TikTok CDN
    if (imageUrl.includes('tiktokcdn')) {
      fetchHeaders['Referer'] = 'https://www.tiktok.com/';
      fetchHeaders['Origin'] = 'https://www.tiktok.com';
      fetchHeaders['Sec-Fetch-Dest'] = 'image';
      fetchHeaders['Sec-Fetch-Mode'] = 'no-cors';
      fetchHeaders['Sec-Fetch-Site'] = 'cross-site';
      console.log('🎯 [IMAGE-PROXY] Using TikTok-specific headers');
    }

    let response = await fetch(imageUrl, { headers: fetchHeaders });
    let fetchStrategy = 'initial';

    const fetchTime = Date.now() - startTime;
    console.log('📊 [IMAGE-PROXY] Fetch completed in', fetchTime + 'ms');
    console.log('📡 [IMAGE-PROXY] Fetch status:', response.status, response.statusText);

    // Retry logic for 403 Forbidden errors
    if (response.status === 403) {
      console.log('🔄 [IMAGE-PROXY] Got 403 Forbidden, trying alternative approaches...');
      
      // Strategy 1: Try without referrer headers (some CDNs block specific referrers)
      console.log('🔄 [IMAGE-PROXY] Retry 1: Removing referrer headers...');
      const noReferrerHeaders = { ...fetchHeaders };
      delete noReferrerHeaders['Referer'];
      delete noReferrerHeaders['Origin'];
      
      response = await fetch(imageUrl, { headers: noReferrerHeaders });
      console.log('📡 [IMAGE-PROXY] Retry 1 status:', response.status, response.statusText);
      
      if (response.ok) {
        fetchStrategy = 'no-referrer';
      } else if (response.status === 403 && imageUrl.includes('tiktokcdn')) {
        // Strategy 2: Try removing URL parameters that might trigger restrictions
        console.log('🔄 [IMAGE-PROXY] Retry 2: Simplifying TikTok URL...');
        const simplifiedUrl = imageUrl.split('?')[0]; // Remove all query parameters
        console.log('🔗 [IMAGE-PROXY] Simplified URL:', simplifiedUrl);
        
        response = await fetch(simplifiedUrl, { headers: noReferrerHeaders });
        console.log('📡 [IMAGE-PROXY] Retry 2 status:', response.status, response.statusText);
        
        if (response.ok) {
          fetchStrategy = 'simplified-url';
        } else if (response.status === 403) {
          // Strategy 3: Try with minimal headers (like a simple curl request)
          console.log('🔄 [IMAGE-PROXY] Retry 3: Using minimal headers...');
          const minimalHeaders = {
            'User-Agent': 'curl/7.68.0',
            'Accept': '*/*'
          };
          
          response = await fetch(simplifiedUrl, { headers: minimalHeaders });
          console.log('📡 [IMAGE-PROXY] Retry 3 status:', response.status, response.statusText);
          
          if (response.ok) {
            fetchStrategy = 'minimal-headers';
          } else if (response.status === 403) {
            // Strategy 4: Try different TikTok CDN domains
            console.log('🔄 [IMAGE-PROXY] Retry 4: Trying alternative CDN domains...');
            const cdnDomains = [
              'p16-sign-va.tiktokcdn.com',
              'p19-sign-va.tiktokcdn.com', 
              'p16-amd-va.tiktokcdn.com',
              'p77-sign-va.tiktokcdn.com'
            ];
            
            for (const domain of cdnDomains) {
              if (simplifiedUrl.includes(domain)) continue; // Skip if already using this domain
              
              const alternativeDomainUrl = simplifiedUrl.replace(/p\d+-[^.]+\.tiktokcdn[^/]*/, domain);
              console.log('🔗 [IMAGE-PROXY] Trying alternative domain:', alternativeDomainUrl);
              
              try {
                response = await fetch(alternativeDomainUrl, { headers: minimalHeaders });
                console.log('📡 [IMAGE-PROXY] Alternative domain status:', response.status, response.statusText);
                
                if (response.ok) {
                  fetchStrategy = 'alternative-domain';
                  break;
                }
              } catch (domainError) {
                console.log('❌ [IMAGE-PROXY] Alternative domain failed:', domain);
                continue;
              }
            }
          }
        }
      }
    } else if (response.ok) {
      fetchStrategy = 'initial-success';
    }

    if (!response.ok) {
      console.error('❌ [IMAGE-PROXY] All fetch attempts failed:', response.status, response.statusText);
      console.error('📍 [IMAGE-PROXY] Final URL attempted:', imageUrl);
      
      // For TikTok CDN failures, serve a placeholder instead of failing
      if (imageUrl.includes('tiktokcdn') && response.status === 403) {
        console.log('🔄 [IMAGE-PROXY] Serving placeholder for blocked TikTok image');
        
        // Generate a simple colored circle SVG as placeholder
        const username = imageUrl.split('/').pop()?.split('~')[0] || 'user';
        const color = `hsl(${username.charCodeAt(0) * 7 % 360}, 70%, 50%)`;
        const initial = username.charAt(0).toUpperCase();
        
        const placeholderSvg = `
          <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="100" fill="${color}"/>
            <text x="100" y="120" font-family="Arial, sans-serif" font-size="80" font-weight="bold" 
                  fill="white" text-anchor="middle">${initial}</text>
          </svg>
        `;
        
        const placeholderBuffer = Buffer.from(placeholderSvg);
        
        console.log('✅ [IMAGE-PROXY] Generated placeholder SVG');
        console.log('📏 [IMAGE-PROXY] Placeholder size:', placeholderBuffer.length, 'bytes');
        
        return new NextResponse(placeholderBuffer, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=300', // Shorter cache for placeholders
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'X-Image-Proxy-Time': (Date.now() - startTime).toString(),
            'X-Image-Proxy-Source': 'placeholder-403',
            'X-Image-Original-Format': 'blocked',
            'X-Image-Fetch-Strategy': 'placeholder',
            'X-Image-Final-Status': '403-placeholder',
          },
        });
      }
      
      return new NextResponse(`Failed to fetch image: ${response.status} ${response.statusText}`, { 
        status: response.status 
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(new Uint8Array(arrayBuffer));

    let contentType = response.headers.get('content-type') || 'image/jpeg';
    console.log('🎨 [IMAGE-PROXY] Original content type:', contentType);
    console.log('📏 [IMAGE-PROXY] Original buffer size:', buffer.length, 'bytes');

    // Handle HEIC/HEIF images using heic-convert (Vercel-compatible)
    if (isHeic || contentType === 'image/heic' || contentType === 'image/heif') {
      console.log('🔄 [IMAGE-PROXY] Processing HEIC/HEIF image for browser compatibility');
      
      try {
        // Primary method: Use heic-convert (works on Vercel)
        console.log('🔄 [IMAGE-PROXY] Converting HEIC using heic-convert package...');
        const convertStartTime = Date.now();
        
        const outputBuffer = await convert({
          buffer: buffer, // the HEIC file buffer
          format: 'JPEG',
          quality: 0.85
        });
        
        const convertTime = Date.now() - convertStartTime;
        buffer = Buffer.from(outputBuffer);
        contentType = 'image/jpeg';
        
        console.log('✅ [IMAGE-PROXY] HEIC conversion successful with heic-convert');
        console.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
        console.log('📏 [IMAGE-PROXY] Converted buffer size:', buffer.length, 'bytes');
        console.log('🎯 [IMAGE-PROXY] Final content type:', contentType);
        
      } catch (heicConvertError) {
        console.error('❌ [IMAGE-PROXY] heic-convert failed:', heicConvertError.message);
        console.log('🔄 [IMAGE-PROXY] Trying Sharp as fallback...');
        
        try {
          // Fallback method: Try Sharp (likely to fail on Vercel)
          const convertStartTime = Date.now();
          buffer = await sharp(buffer)
            .jpeg({ quality: 85 })
            .toBuffer();
          
          const convertTime = Date.now() - convertStartTime;
          contentType = 'image/jpeg';
          
          console.log('✅ [IMAGE-PROXY] HEIC conversion successful with Sharp fallback');
          console.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
          
        } catch (sharpError) {
          console.error('❌ [IMAGE-PROXY] Sharp fallback also failed:', sharpError.message);
          console.log('🔄 [IMAGE-PROXY] Trying TikTok JPEG URL alternative...');
          
          // Final fallback: Try to fetch JPEG version from TikTok
          if (imageUrl.includes('tiktokcdn') && imageUrl.includes('.heic')) {
            try {
              console.log('🔄 [IMAGE-PROXY] Trying to fetch JPEG version from TikTok...');
              
              // Replace .heic with .jpeg and remove quality params that might force HEIC
              let jpegUrl = imageUrl.replace(/\.heic(\?|$)/, '.jpeg$1');
              jpegUrl = jpegUrl.replace(/~tplv-[^~]*~/g, '~tplv-default~'); // Remove specific format params
              
              console.log('🔗 [IMAGE-PROXY] Trying JPEG URL:', jpegUrl);
              
              const jpegResponse = await fetch(jpegUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
              });
              
              if (jpegResponse.ok) {
                const jpegArrayBuffer = await jpegResponse.arrayBuffer();
                buffer = Buffer.from(new Uint8Array(jpegArrayBuffer));
                contentType = 'image/jpeg';
                
                console.log('✅ [IMAGE-PROXY] Successfully fetched JPEG alternative');
                console.log('📏 [IMAGE-PROXY] JPEG buffer size:', buffer.length, 'bytes');
              } else {
                throw new Error('JPEG alternative not available');
              }
            } catch (alternativeError) {
              console.error('❌ [IMAGE-PROXY] All conversion methods failed:', alternativeError.message);
              console.log('🔄 [IMAGE-PROXY] Serving original HEIC (modern browsers may support it)');
              // Keep original HEIC buffer and content type
            }
          } else {
            console.log('🔄 [IMAGE-PROXY] Non-TikTok HEIC, serving original format');
            // Keep original buffer and content type
          }
        }
      }
    } else {
      console.log('✅ [IMAGE-PROXY] Image format compatible, no conversion needed');
    }

    const totalTime = Date.now() - startTime;
    console.log('🏁 [IMAGE-PROXY] Total processing time:', totalTime + 'ms');
    console.log('📤 [IMAGE-PROXY] Sending response with content-type:', contentType);

    // Determine the conversion method used for headers
    const conversionMethod = isHeic ? 
      (contentType === 'image/jpeg' ? 'heic-converted' : 'heic-original') : 
      'original';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'X-Image-Proxy-Time': totalTime.toString(),
        'X-Image-Proxy-Source': conversionMethod,
        'X-Image-Original-Format': isHeic ? 'heic' : 'other',
        'X-Image-Fetch-Strategy': fetchStrategy,
        'X-Image-Final-Status': response.status.toString(),
      },
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error('❌ [IMAGE-PROXY] Critical error after', errorTime + 'ms:', error);
    console.error('📍 [IMAGE-PROXY] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new NextResponse('Error fetching image', { status: 500 });
  }
} 