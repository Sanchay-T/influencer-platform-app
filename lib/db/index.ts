import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Vercel serverless functions spin up many short-lived workers.  If we create a
 * brand-new `postgres()` client on every cold start we quickly exhaust the
 * connection limit of Supabase/Postgres.  Instead we cache the client & Drizzle
 * instance on `globalThis` so subsequent invocations reuse the existing pool
 * (similar to how Prisma suggests `global.prisma`).
 * 
 * Environment Support:
 * - Development: Uses local PostgreSQL via .env.development
 * - Production: Uses Supabase via .env.local
 */

declare global {
   
  var __queryClient: ReturnType<typeof postgres> | undefined;
   
  var __db: ReturnType<typeof drizzle> | undefined;
}

const connectionString = process.env.DATABASE_URL!;

// Environment detection
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

// 🔍 DIAGNOSTIC LOGS - Connection Analysis
console.log(`🗄️ [DATABASE] Environment: ${isLocal ? 'LOCAL' : 'REMOTE'}`);
console.log(`🗄️ [DATABASE] Connection: ${connectionString.replace(/\/\/.*@/, '//***@')}`);
console.log('🔍 [DATABASE-DEBUG] Connection Diagnostics:', {
  hasUsername: connectionString.includes('postgres:'),
  hasPassword: connectionString.includes(':localdev123@'),
  hasHost: connectionString.includes('localhost:5432'),
  hasDatabase: connectionString.includes('influencer_platform_dev'),
  fullMatch: connectionString.includes('postgresql://postgres:localdev123@localhost:5432/influencer_platform_dev')
});

// Re-use or create a single query client (uses Postgres.js built-in pooling)
const queryClient =
  global.__queryClient ??
  postgres(connectionString, {
    // Local development settings vs production
    idle_timeout: isLocal ? 120 : 30, // Keep local connections alive longer
    max_lifetime: isLocal ? 60 * 60 * 2 : 60 * 60, // 2h local vs 1h remote
    max: isLocal ? 10 : 5, // More connections locally for development
    connect_timeout: isLocal ? 30 : 10, // Longer timeout for local Docker
  });

if (!global.__queryClient) global.__queryClient = queryClient;

// Note: We only use Supabase for database hosting, auth is handled by Clerk

// Re-use Drizzle ORM wrapper as well
export const db =
  global.__db ??
  drizzle(queryClient, {
    schema: {
      ...schema,
      scrapingJobsRelations: schema.scrapingJobsRelations,
      scrapingResultsRelations: schema.scrapingResultsRelations,
    },
  });

if (!global.__db) global.__db = db; // cache for later lambdas 