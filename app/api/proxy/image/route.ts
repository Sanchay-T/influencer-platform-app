import convert from 'heic-convert';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { logger } from '@/lib/logging';
import { backgroundJobLogger, jobLog } from '@/lib/logging/background-job-logger';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { LogCategory } from '@/lib/logging/types';
import { toError } from '@/lib/utils/type-guards';

// @performance Vercel timeout protection - image fetching with retries can take time
export const maxDuration = 30;

// Generate placeholder for failed images
function generatePlaceholderResponse(imageUrl: string, jobId?: string) {
	// Extract username or create a generic placeholder
	let initial = '?';
	let color = '#6B7280'; // Default gray
	let platform = 'unknown';

	try {
		// Try to extract some identifier from the URL for personalization
		if (imageUrl.includes('instagram')) {
			initial = 'I';
			color = '#E1306C'; // Instagram pink
			platform = 'instagram';
		} else if (imageUrl.includes('tiktok')) {
			initial = 'T';
			color = '#FF0050'; // TikTok red
			platform = 'tiktok';
		} else {
			initial = 'U'; // Unknown/User
			color = '#3B82F6'; // Blue
		}
	} catch (e) {
		// Use defaults
	}

	const placeholderSvg = `
    <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
      <circle cx="75" cy="75" r="75" fill="${color}"/>
      <text x="75" y="85" font-family="Arial, sans-serif" font-size="60" font-weight="bold" 
            fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `;

	if (jobId) {
		jobLog.image(jobId, 'placeholder-generation', 'failed-network', 'svg', true, 0);
	}

	logger.debug(
		'Generated image placeholder',
		{
			jobId,
			platform,
			imageUrl: imageUrl.substring(0, 100) + '...',
			initial,
			color,
		},
		LogCategory.STORAGE
	);

	return new NextResponse(Buffer.from(placeholderSvg), {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
			'Access-Control-Allow-Origin': '*',
			'X-Image-Proxy-Source': 'placeholder-network-error',
			'X-Image-Original-Format': 'failed',
		},
	});
}

export async function GET(request: Request) {
	const startTime = Date.now();
	const requestId = Math.random().toString(36).slice(2, 8);

	// Start image processing job tracking
	const jobId = jobLog.start({
		jobType: 'image-processing',
		requestId,
		metadata: { operation: 'image-proxy' },
	});

	try {
		const { searchParams } = new URL(request.url);
		const imageUrl = searchParams.get('url');

		logger.info(
			'Image proxy request started',
			{
				requestId,
				jobId,
				sourceUrl: imageUrl?.substring(0, 100) + '...',
				metadata: {
					method: request.method,
					urlLength: imageUrl?.length || 0,
					isBlob: imageUrl?.includes('blob.vercel-storage.com'),
					isTikTok: imageUrl?.includes('tiktok'),
				},
			},
			LogCategory.API
		);

		if (!imageUrl) {
			logger.error('Missing image URL parameter', undefined, { requestId, jobId }, LogCategory.API);
			jobLog.fail(jobId, new Error('Missing image URL parameter'), undefined, false);
			return new NextResponse('Missing image URL', { status: 400 });
		}

		// Check if this is a blob URL (which shouldn't be proxied)
		if (imageUrl.includes('blob.vercel-storage.com')) {
			logger.warn(
				'Received blob URL for proxying - redirecting directly',
				{
					requestId,
					jobId,
					blobUrl: imageUrl,
					metadata: {
						issue: 'double-proxying-cached-images',
						recommendation: 'frontend-should-use-blob-urls-directly',
					},
				},
				LogCategory.STORAGE
			);

			jobLog.complete(
				jobId,
				{ duration: Date.now() - startTime },
				{ metadata: { action: 'blob-redirect' } }
			);

			return NextResponse.redirect(imageUrl, 302);
		}

		// Detect image format from URL
		const isHeic =
			imageUrl.toLowerCase().includes('.heic') || imageUrl.toLowerCase().includes('.heif');
		structuredConsole.log('🔍 [IMAGE-PROXY] Detected format:', isHeic ? 'HEIC/HEIF' : 'Other');

		structuredConsole.log('📡 [IMAGE-PROXY] Fetching image from source...');

		// Enhanced headers to bypass CDN restrictions
		const fetchHeaders: Record<string, string> = {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
			Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.9',
			'Accept-Encoding': 'gzip, deflate, br',
			'Cache-Control': 'no-cache',
			Pragma: 'no-cache',
		};

		// Add specific headers for TikTok CDN
		if (imageUrl.includes('tiktokcdn')) {
			fetchHeaders.Referer = 'https://www.tiktok.com/';
			fetchHeaders.Origin = 'https://www.tiktok.com';
			fetchHeaders['Sec-Fetch-Dest'] = 'image';
			fetchHeaders['Sec-Fetch-Mode'] = 'no-cors';
			fetchHeaders['Sec-Fetch-Site'] = 'cross-site';
			structuredConsole.log('🎯 [IMAGE-PROXY] Using TikTok-specific headers');
		}

		let response;
		let fetchStrategy = 'initial';

		try {
			response = await fetch(imageUrl, { headers: fetchHeaders });
			const fetchTime = Date.now() - startTime;
			structuredConsole.log('📊 [IMAGE-PROXY] Fetch completed in', fetchTime + 'ms');
			structuredConsole.log('📡 [IMAGE-PROXY] Fetch status:', response.status, response.statusText);
		} catch (fetchError: unknown) {
			const error = toError(fetchError);
			structuredConsole.error('❌ [IMAGE-PROXY] Network error:', error.message);

			// Handle DNS resolution errors (common with Instagram CDN)
			const causeMessage =
				error.cause instanceof Error
					? error.cause.message
					: typeof error.cause === 'string'
						? error.cause
						: '';
			if (causeMessage.includes('ENOTFOUND') || error.message.includes('getaddrinfo ENOTFOUND')) {
				structuredConsole.log('🔄 [IMAGE-PROXY] DNS resolution failed, generating placeholder...');
				return generatePlaceholderResponse(imageUrl);
			}

			// Handle other network errors
			structuredConsole.log('🔄 [IMAGE-PROXY] Network error, generating placeholder...');
			return generatePlaceholderResponse(imageUrl);
		}

		// Retry logic for 403 Forbidden errors
		if (response.status === 403) {
			structuredConsole.log('🔄 [IMAGE-PROXY] Got 403 Forbidden, trying alternative approaches...');

			// Strategy 1: Try without referrer headers (some CDNs block specific referrers)
			structuredConsole.log('🔄 [IMAGE-PROXY] Retry 1: Removing referrer headers...');
			const noReferrerHeaders: Record<string, string> = { ...fetchHeaders };
			delete noReferrerHeaders.Referer;
			delete noReferrerHeaders.Origin;

			response = await fetch(imageUrl, { headers: noReferrerHeaders });
			structuredConsole.log(
				'📡 [IMAGE-PROXY] Retry 1 status:',
				response.status,
				response.statusText
			);

			if (response.ok) {
				fetchStrategy = 'no-referrer';
			} else if (response.status === 403 && imageUrl.includes('tiktokcdn')) {
				// Strategy 2: Try removing URL parameters that might trigger restrictions
				structuredConsole.log('🔄 [IMAGE-PROXY] Retry 2: Simplifying TikTok URL...');
				const simplifiedUrl = imageUrl.split('?')[0]; // Remove all query parameters
				structuredConsole.log('🔗 [IMAGE-PROXY] Simplified URL:', simplifiedUrl);

				response = await fetch(simplifiedUrl, { headers: noReferrerHeaders });
				structuredConsole.log(
					'📡 [IMAGE-PROXY] Retry 2 status:',
					response.status,
					response.statusText
				);

				if (response.ok) {
					fetchStrategy = 'simplified-url';
				} else if (response.status === 403) {
					// Strategy 3: Try with minimal headers (like a simple curl request)
					structuredConsole.log('🔄 [IMAGE-PROXY] Retry 3: Using minimal headers...');
					const minimalHeaders = {
						'User-Agent': 'curl/7.68.0',
						Accept: '*/*',
					};

					response = await fetch(simplifiedUrl, { headers: minimalHeaders });
					structuredConsole.log(
						'📡 [IMAGE-PROXY] Retry 3 status:',
						response.status,
						response.statusText
					);

					if (response.ok) {
						fetchStrategy = 'minimal-headers';
					} else if (response.status === 403) {
						// Strategy 4: Try different TikTok CDN domains
						structuredConsole.log('🔄 [IMAGE-PROXY] Retry 4: Trying alternative CDN domains...');
						const cdnDomains = [
							'p16-sign-va.tiktokcdn.com',
							'p19-sign-va.tiktokcdn.com',
							'p16-amd-va.tiktokcdn.com',
							'p77-sign-va.tiktokcdn.com',
						];

						for (const domain of cdnDomains) {
							if (simplifiedUrl.includes(domain)) continue; // Skip if already using this domain

							const alternativeDomainUrl = simplifiedUrl.replace(
								/p\d+-[^.]+\.tiktokcdn[^/]*/,
								domain
							);
							structuredConsole.log(
								'🔗 [IMAGE-PROXY] Trying alternative domain:',
								alternativeDomainUrl
							);

							try {
								response = await fetch(alternativeDomainUrl, { headers: minimalHeaders });
								structuredConsole.log(
									'📡 [IMAGE-PROXY] Alternative domain status:',
									response.status,
									response.statusText
								);

								if (response.ok) {
									fetchStrategy = 'alternative-domain';
									break;
								}
							} catch (domainError) {
								structuredConsole.log('❌ [IMAGE-PROXY] Alternative domain failed:', domain);
							}
						}
					}
				}
			}
		} else if (response.ok) {
			fetchStrategy = 'initial-success';
		}

		if (!response.ok) {
			structuredConsole.error(
				'❌ [IMAGE-PROXY] All fetch attempts failed:',
				response.status,
				response.statusText
			);
			structuredConsole.error('📍 [IMAGE-PROXY] Final URL attempted:', imageUrl);

			// For TikTok CDN failures, serve a placeholder instead of failing
			if (imageUrl.includes('tiktokcdn') && response.status === 403) {
				structuredConsole.log('🔄 [IMAGE-PROXY] Serving placeholder for blocked TikTok image');

				// Generate a simple colored circle SVG as placeholder
				const username = imageUrl.split('/').pop()?.split('~')[0] || 'user';
				const color = `hsl(${(username.charCodeAt(0) * 7) % 360}, 70%, 50%)`;
				const initial = username.charAt(0).toUpperCase();

				const placeholderSvg = `
          <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="100" fill="${color}"/>
            <text x="100" y="120" font-family="Arial, sans-serif" font-size="80" font-weight="bold" 
                  fill="white" text-anchor="middle">${initial}</text>
          </svg>
        `;

				const placeholderBuffer = Buffer.from(placeholderSvg);

				structuredConsole.log('✅ [IMAGE-PROXY] Generated placeholder SVG');
				structuredConsole.log(
					'📏 [IMAGE-PROXY] Placeholder size:',
					placeholderBuffer.length,
					'bytes'
				);

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
				status: response.status,
			});
		}

		const arrayBuffer = await response.arrayBuffer();
		let buffer = Buffer.from(new Uint8Array(arrayBuffer));

		let contentType = response.headers.get('content-type') || 'image/jpeg';
		structuredConsole.log('🎨 [IMAGE-PROXY] Original content type:', contentType);
		structuredConsole.log('📏 [IMAGE-PROXY] Original buffer size:', buffer.length, 'bytes');

		// Handle HEIC/HEIF images using heic-convert (Vercel-compatible)
		if (isHeic || contentType === 'image/heic' || contentType === 'image/heif') {
			structuredConsole.log(
				'🔄 [IMAGE-PROXY] Processing HEIC/HEIF image for browser compatibility'
			);

			try {
				// Primary method: Use heic-convert (works on Vercel)
				structuredConsole.log('🔄 [IMAGE-PROXY] Converting HEIC using heic-convert package...');
				const convertStartTime = Date.now();

				const outputBuffer = await convert({
					buffer: buffer, // the HEIC file buffer
					format: 'JPEG',
					quality: 0.85,
				});

				const convertTime = Date.now() - convertStartTime;
				buffer =
					outputBuffer instanceof ArrayBuffer
						? Buffer.from(outputBuffer)
						: Buffer.from(outputBuffer);
				contentType = 'image/jpeg';

				structuredConsole.log('✅ [IMAGE-PROXY] HEIC conversion successful with heic-convert');
				structuredConsole.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
				structuredConsole.log('📏 [IMAGE-PROXY] Converted buffer size:', buffer.length, 'bytes');
				structuredConsole.log('🎯 [IMAGE-PROXY] Final content type:', contentType);
			} catch (heicConvertError) {
				const error = toError(heicConvertError);
				structuredConsole.error('❌ [IMAGE-PROXY] heic-convert failed:', error.message);
				structuredConsole.log('🔄 [IMAGE-PROXY] Trying Sharp as fallback...');

				try {
					// Fallback method: Try Sharp (likely to fail on Vercel)
					const convertStartTime = Date.now();
					const sharpBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
					buffer = Buffer.from(sharpBuffer);

					const convertTime = Date.now() - convertStartTime;
					contentType = 'image/jpeg';

					structuredConsole.log('✅ [IMAGE-PROXY] HEIC conversion successful with Sharp fallback');
					structuredConsole.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
				} catch (sharpError) {
					const error = toError(sharpError);
					structuredConsole.error('❌ [IMAGE-PROXY] Sharp fallback also failed:', error.message);
					structuredConsole.log('🔄 [IMAGE-PROXY] Trying TikTok JPEG URL alternative...');

					// Final fallback: Try to fetch JPEG version from TikTok
					if (imageUrl.includes('tiktokcdn') && imageUrl.includes('.heic')) {
						try {
							structuredConsole.log('🔄 [IMAGE-PROXY] Trying to fetch JPEG version from TikTok...');

							// Replace .heic with .jpeg and remove quality params that might force HEIC
							let jpegUrl = imageUrl.replace(/\.heic(\?|$)/, '.jpeg$1');
							jpegUrl = jpegUrl.replace(/~tplv-[^~]*~/g, '~tplv-default~'); // Remove specific format params

							structuredConsole.log('🔗 [IMAGE-PROXY] Trying JPEG URL:', jpegUrl);

							const jpegResponse = await fetch(jpegUrl, {
								headers: {
									'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
								},
							});

							if (jpegResponse.ok) {
								const jpegArrayBuffer = await jpegResponse.arrayBuffer();
								buffer = Buffer.from(new Uint8Array(jpegArrayBuffer));
								contentType = 'image/jpeg';

								structuredConsole.log('✅ [IMAGE-PROXY] Successfully fetched JPEG alternative');
								structuredConsole.log('📏 [IMAGE-PROXY] JPEG buffer size:', buffer.length, 'bytes');
							} else {
								throw new Error('JPEG alternative not available');
							}
						} catch (alternativeError) {
							const error = toError(alternativeError);
							structuredConsole.error(
								'❌ [IMAGE-PROXY] All conversion methods failed:',
								error.message
							);
							structuredConsole.log(
								'🔄 [IMAGE-PROXY] Serving original HEIC (modern browsers may support it)'
							);
							// Keep original HEIC buffer and content type
						}
					} else {
						structuredConsole.log('🔄 [IMAGE-PROXY] Non-TikTok HEIC, serving original format');
						// Keep original buffer and content type
					}
				}
			}
		} else {
			structuredConsole.log('✅ [IMAGE-PROXY] Image format compatible, no conversion needed');
		}

		const totalTime = Date.now() - startTime;

		structuredConsole.log('🏁 [IMAGE-PROXY] Processing complete!');
		structuredConsole.log('📤 [IMAGE-PROXY] Final response details:', {
			contentType: contentType,
			bufferSize: buffer.length,
			totalTime: totalTime + 'ms',
			fetchStrategy: fetchStrategy,
			requestId: requestId,
		});

		// Determine the conversion method used for headers
		const conversionMethod = isHeic
			? contentType === 'image/jpeg'
				? 'heic-converted'
				: 'heic-original'
			: 'original';

		structuredConsole.log('✅ [IMAGE-PROXY] Sending successful response');
		structuredConsole.groupEnd();

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
				'X-Request-ID': requestId,
			},
		});
	} catch (error) {
		const errorTime = Date.now() - startTime;
		structuredConsole.error('❌ [IMAGE-PROXY] Critical error after', errorTime + 'ms:', error);
		structuredConsole.error('📍 [IMAGE-PROXY] Error details:', {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : 'No stack trace',
			requestId: requestId,
			errorTime: errorTime + 'ms',
		});
		structuredConsole.groupEnd();
		return new NextResponse('Error fetching image', { status: 500 });
	}
}
