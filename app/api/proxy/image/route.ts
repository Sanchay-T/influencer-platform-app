import { NextResponse } from 'next/server';
import sharp from 'sharp';

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

    // Convert HEIC/HEIF to JPEG for browser compatibility
    if (isHeic || contentType === 'image/heic' || contentType === 'image/heif') {
      console.log('🔄 [IMAGE-PROXY] Converting HEIC/HEIF to JPEG for browser compatibility');
      
      try {
        const convertStartTime = Date.now();
        buffer = await sharp(buffer)
          .jpeg({ quality: 85 })
          .toBuffer();
        
        const convertTime = Date.now() - convertStartTime;
        contentType = 'image/jpeg';
        
        console.log('✅ [IMAGE-PROXY] HEIC conversion successful');
        console.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
        console.log('📏 [IMAGE-PROXY] Converted buffer size:', buffer.length, 'bytes');
        console.log('🎯 [IMAGE-PROXY] Final content type:', contentType);
      } catch (conversionError) {
        console.error('❌ [IMAGE-PROXY] HEIC conversion failed:', conversionError);
        console.log('🔄 [IMAGE-PROXY] Falling back to original image');
        // Keep original buffer and content type
      }
    } else {
      console.log('✅ [IMAGE-PROXY] Image format compatible, no conversion needed');
    }

    const totalTime = Date.now() - startTime;
    console.log('🏁 [IMAGE-PROXY] Total processing time:', totalTime + 'ms');
    console.log('📤 [IMAGE-PROXY] Sending response with content-type:', contentType);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'X-Image-Proxy-Time': totalTime.toString(),
        'X-Image-Proxy-Source': isHeic ? 'heic-converted' : 'original',
      },
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error('❌ [IMAGE-PROXY] Critical error after', errorTime + 'ms:', error);
    console.error('📍 [IMAGE-PROXY] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new NextResponse('Error fetching image', { status: 500 });
  }
} 