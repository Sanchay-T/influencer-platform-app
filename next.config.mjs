import { withSentryConfig } from '@sentry/nextjs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Suppress warnings
    config.ignoreWarnings = [
      {
        module: /libheif-js/,
        message: /Critical dependency/,
      },
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    // [webpack-alias] Ensure '@/...' imports resolve in CI/Vercel builds.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(process.cwd()),
      '#async_hooks': 'async_hooks',
      'p-limit$': path.resolve(process.cwd(), 'node_modules/p-limit/index.js'),
    };
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };

    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/video-proxy',
        destination: 'https://tiktok-proxy.jahirjimenez1010.workers.dev/',
      },
    ];
  },
};

/**
 * Sentry configuration options for build-time integration.
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
const sentryWebpackPluginOptions = {
  // Sentry organization and project (set via environment variables)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps (set via environment variable)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only upload source maps in production builds
  silent: process.env.NODE_ENV !== 'production',

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Automatically instrument API routes
  automaticVercelMonitors: true,

  // Hide source maps from clients (security)
  hideSourceMaps: true,

  // Disable the Sentry SDK logger (too verbose)
  disableLogger: true,

  // Tunnel route to bypass ad blockers (optional)
  // tunnelRoute: '/monitoring',
};

// Only wrap with Sentry if we have ALL required environment variables
// Missing SENTRY_ORG/PROJECT/AUTH_TOKEN will cause build failures
const hasSentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const hasSentryUploadConfig =
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT &&
  process.env.SENTRY_AUTH_TOKEN;

const shouldUseSentry = hasSentryDsn && hasSentryUploadConfig;

export default shouldUseSentry
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
