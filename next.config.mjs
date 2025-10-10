import { withSentryConfig } from "@sentry/nextjs";
import path from 'path'
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

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
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      {
        module: /@sentry/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];
    
    // Note: We no longer alias '@clerk/nextjs/server' to avoid edge/runtime conflicts.

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
  
  // Error handling: never fail the build due to Sentry plugin errors unless explicitly enabled
  errorHandler: (err, invokeErr, compilation) => {
    console.warn('[SENTRY-WEBPACK] Non-fatal error:', err?.message || err);
    if (process.env.SENTRY_STRICT === 'true') {
      // Opt-in strict mode to fail builds on Sentry errors
      invokeErr();
    } else {
      // Default: swallow errors to keep Vercel builds green
      return;
    }
  },
  
  // Deployment tracking
  deploy: isCI ? {
    env: environment,
    name: process.env.VERCEL_GIT_COMMIT_SHA || `deploy-${Date.now()}`,
    url: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL,
  } : undefined,
};

// Enable Sentry webpack only when properly configured to avoid build failures on CI/Vercel
const hasSentryCredentials = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
const enableSentryWebpack = process.env.ENABLE_SENTRY_BUILD === 'true' && hasSentryCredentials;

if (!enableSentryWebpack) {
  const reason = !hasSentryCredentials 
    ? 'missing Sentry credentials (SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT)' 
    : 'not explicitly enabled via ENABLE_SENTRY_BUILD=true';
  console.warn(`[SENTRY-WEBPACK] Skipping Sentry webpack plugin: ${reason}`);
}

export default enableSentryWebpack ? withSentryConfig(nextConfig, sentryWebpackConfig) : nextConfig;
