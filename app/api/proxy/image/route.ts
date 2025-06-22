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
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    const fetchTime = Date.now() - startTime;
    console.log('📊 [IMAGE-PROXY] Fetch completed in', fetchTime + 'ms');
    console.log('📡 [IMAGE-PROXY] Fetch status:', response.status, response.statusText);

    if (!response.ok) {
      console.error('❌ [IMAGE-PROXY] Failed to fetch image:', response.status, response.statusText);
      return new NextResponse('Failed to fetch image', { status: response.status });
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
      },
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error('❌ [IMAGE-PROXY] Critical error after', errorTime + 'ms:', error);
    console.error('📍 [IMAGE-PROXY] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new NextResponse('Error fetching image', { status: 500 });
  }
} 