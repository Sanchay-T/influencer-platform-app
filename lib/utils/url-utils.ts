/**
 * URL utilities for handling development vs production environments
 */

/**
 * Get the client URL for browser redirects (Stripe checkout, etc.)
 * - Development: Use localhost:3000 for local browser access
 * - Production: Use the live domain
 */
export function getClientUrl(): string {
  // In development, detect the actual running port
  if (process.env.NODE_ENV === 'development') {
    // Check for custom port configuration
    const localPort = process.env.LOCAL_PORT || process.env.PORT || '3000';
    return `http://localhost:${localPort}`;
  }
  
  // In production, use the configured site URL
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app';
}

/**
 * Get the server URL for webhooks (QStash, Stripe webhooks, etc.)
 * - Development: Use ngrok URL for external webhook access
 * - Production: Use the live domain
 */
export function getServerUrl(): string {
  // Always use NEXT_PUBLIC_SITE_URL for webhooks (ngrok in dev, live domain in prod)
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app';
}

/**
 * Get the webhook URL specifically (always uses ngrok/external URL)
 * Use this for QStash callbacks, Stripe webhooks, etc.
 */
export function getWebhookUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app';
}

/**
 * Get the appropriate URL for different use cases
 */
export function getUrl(type: 'client' | 'server' | 'webhook'): string {
  switch (type) {
    case 'client':
      return getClientUrl();
    case 'webhook':
      return getWebhookUrl();
    case 'server':
    default:
      return getServerUrl();
  }
}
