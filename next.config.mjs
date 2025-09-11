import { withSentryConfig } from "@sentry/nextjs";
import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  webpack: (config, { isServer }) => {
    // Suppress the libheif-js warning
    config.ignoreWarnings = [
      {
        module: /libheif-js/,
        message: /Critical dependency/,
      },
    ];
    
    // Note: We no longer alias '@clerk/nextjs/server' to avoid edge/runtime conflicts.
    
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/video-proxy',
        destination: 'https://tiktok-proxy.jahirjimenez1010.workers.dev/',
      }
    ];
  }
}

// Injected content via Sentry wizard below

// Environment-specific Sentry configuration
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const isDevelopment = environment === 'development';
const isProduction = environment === 'production';
const isCI = process.env.CI === 'true';

// Sentry webpack plugin configuration
const sentryWebpackConfig = {
  // Organization and project settings
  org: process.env.SENTRY_ORG || "none-vx0",
  project: process.env.SENTRY_PROJECT || "influencer-platform", // Updated to match project
  
  // Authentication
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Logging settings - verbose in CI, quiet otherwise
  silent: !isCI && !isDevelopment,
  debug: isDevelopment,
  
  // Source maps configuration - environment specific
  widenClientFileUpload: true,
  hideSourceMaps: isProduction, // Only hide in production
  
  // Release management
  release: {
    name: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE,
    setCommits: isCI ? {
      auto: true,
      ignoreMissing: true,
      ignoreEmpty: true,
    } : undefined,
  },
  
  // Performance optimizations
  disableLogger: isProduction, // Only disable in production
  
  // Tunnel configuration for ad-blocker bypass
  tunnelRoute: "/monitoring",
  
  // Vercel integration
  automaticVercelMonitors: true,
  
  // Build optimizations
  reactComponentAnnotation: {
    enabled: isDevelopment, // Only in development for debugging
  },
  
  // Upload settings
  sourcemaps: {
    assets: ['.next/static/chunks/**/*', '.next/static/css/**/*'],
    ignore: [
      'node_modules/**',
      '.next/cache/**',
      '.next/static/media/**', // Skip media files
    ],
    rewriteSources: (source) => {
      // Clean up source paths for better debugging
      return source.replace(process.cwd(), '').replace(/^\//, '');
    },
  },
  
  // Error handling
  errorHandler: (err, invokeErr, compilation) => {
    console.warn('[SENTRY-WEBPACK] Upload warning:', err.message);
    // Don't fail the build on Sentry upload errors in development
    if (isDevelopment) {
      return;
    }
    invokeErr();
  },
  
  // Deployment tracking
  deploy: isCI ? {
    env: environment,
    name: process.env.VERCEL_GIT_COMMIT_SHA || `deploy-${Date.now()}`,
    url: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL,
  } : undefined,
};

export default withSentryConfig(nextConfig, sentryWebpackConfig);
