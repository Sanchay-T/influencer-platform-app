/**
 * URL utilities for handling development vs production environments
 */

/**
 * Get the client URL for redirects
 * - Development: Use localhost:3000 for Stripe redirects (better for testing)
 * - Production: Use the live domain
 * - QStash: Uses NEXT_PUBLIC_SITE_URL (ngrok) for webhooks
 */
export function getClientUrl(): string {
  // In development, use localhost for Stripe redirects
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.LOCAL_PORT || process.env.PORT || '3000'
    return `http://localhost:${port}`;
  }
  
  // In production, use the live domain
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app';
}

/**
 * Get the server URL for webhooks (QStash, etc.)
 * - Development: Use ngrok URL for external webhooks
 * - Production: Use the live domain
 */
export function getServerUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app';
}

/**
 * Get the appropriate URL for different use cases
 */
export function getUrl(type: 'client' | 'server'): string {
  return type === 'client' ? getClientUrl() : getServerUrl();
}
