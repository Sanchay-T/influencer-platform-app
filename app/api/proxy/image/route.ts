import { NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return new NextResponse('Missing image URL', { status: 400 });
    }

    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – Buffer typing mismatch workaround
    let buffer = Buffer.from(arrayBuffer as any);

    let contentType = response.headers.get('content-type') || 'image/jpeg';

    // Skip HEIC conversion - modern browsers support HEIC
    // Just proxy the original image without conversion
    if (contentType === 'image/heic' || imageUrl.endsWith('.heic')) {
      console.log('Proxying HEIC image without conversion:', imageUrl);
      // Keep original buffer and contentType
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
} 