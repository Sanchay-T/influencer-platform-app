import { NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    console.log('🖼️ Proxying image:', imageUrl);

    if (!imageUrl) {
      return new NextResponse('Missing image URL', { status: 400 });
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    console.log('📡 Image fetch status:', response.status, response.statusText);

    if (!response.ok) {
      console.error('❌ Failed to fetch image:', response.status, response.statusText);
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – Buffer typing mismatch workaround
    let buffer = Buffer.from(arrayBuffer as any);

    let contentType = response.headers.get('content-type') || 'image/jpeg';
    console.log('🎨 Content type:', contentType, 'Buffer size:', buffer.length);

    // Skip HEIC conversion - modern browsers support HEIC
    // Just proxy the original image without conversion
    if (contentType === 'image/heic' || imageUrl.endsWith('.heic')) {
      console.log('🔄 Proxying HEIC image without conversion');
      // Keep original buffer and contentType
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error('❌ Error proxying image:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
} 