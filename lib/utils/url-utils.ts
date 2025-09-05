/**
 * URL utilities for handling development vs production environments
 */

/**
 * Get the client URL for redirects
 * - Development: Use NEXT_PUBLIC_SITE_URL (ngrok) for consistency with Stripe
 * - Production: Use the live domain
 * - QStash: Uses NEXT_PUBLIC_SITE_URL (ngrok) for webhooks
 */
export function getClientUrl(): string {
  // Always use NEXT_PUBLIC_SITE_URL for consistency (especially important with ngrok)
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
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
