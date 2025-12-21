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
      }
    ];
  }
}

export default nextConfig;
