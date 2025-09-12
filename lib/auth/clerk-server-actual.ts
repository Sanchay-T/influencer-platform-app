// Re-export the real Clerk server SDK. This uses a deep import to bypass any
// Webpack aliasing of '@clerk/nextjs/server' to our testable wrapper.
export * from '@clerk/nextjs/dist/cjs/server/index.js';
