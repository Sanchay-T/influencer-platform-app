import { structuredConsole } from '@/lib/logging/console-proxy';
import { put, list } from '@vercel/blob';
import { createHash } from 'crypto';

export class ImageCache {
  private async generateCacheKey(url: string, platform: string, userId?: string): Promise<string> {
    const hash = createHash('md5').update(`${platform}-${userId || 'user'}-${url}`).digest('hex');
    const ext = url.includes('.heic') ? '.jpg' : '.jpg';
    return `${platform.toLowerCase()}/${hash}${ext}`;
  }

  async getCachedImageUrl(originalUrl: string, platform: string, userId?: string): Promise<string> {
    if (!originalUrl) return '';
    
    const cacheKey = await this.generateCacheKey(originalUrl, platform, userId);
    
    // Check if already cached
    try {
      const { blobs } = await list({ prefix: cacheKey.split('/')[0] + '/', limit: 1000 });
      const existing = blobs.find(blob => blob.pathname === cacheKey);
      if (existing) {
        structuredConsole.log(`✅ [CACHE] Found cached: ${cacheKey}`);
        return existing.url;
      }
    } catch (error) {
      structuredConsole.log(`⚠️ [CACHE] Check failed: ${error.message}`);
    }

    // Download and cache
    structuredConsole.log(`📥 [CACHE] Downloading: ${originalUrl}`);
    return await this.downloadAndCache(originalUrl, cacheKey, platform);
  }

  private async downloadAndCache(url: string, cacheKey: string, platform: string): Promise<string> {
    try {
      const headers = platform === 'TikTok' ? {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Origin': 'https://www.tiktok.com'
      } : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      let buffer = Buffer.from(await response.arrayBuffer());
      
      // Convert HEIC to JPEG if needed
      if (url.includes('.heic')) {
        try {
          const convert = require('heic-convert');
          buffer = Buffer.from(await convert({ buffer, format: 'JPEG', quality: 0.85 }));
          structuredConsole.log(`✅ [CACHE] Converted HEIC to JPEG`);
        } catch (error) {
          structuredConsole.log(`⚠️ [CACHE] HEIC conversion failed: ${error.message}`);
        }
      }

      // Store in Vercel Blob
      const blob = await put(cacheKey, buffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });

      structuredConsole.log(`✅ [CACHE] Cached: ${cacheKey} → ${blob.url}`);
      return blob.url;
      
    } catch (error) {
      structuredConsole.log(`❌ [CACHE] Failed: ${error.message}`);
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
  }
}