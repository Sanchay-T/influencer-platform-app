import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Vercel serverless functions spin up many short-lived workers.  If we create a
 * brand-new `postgres()` client on every cold start we quickly exhaust the
 * connection limit of Supabase/Postgres.  Instead we cache the client & Drizzle
 * instance on `globalThis` so subsequent invocations reuse the existing pool
 * (similar to how Prisma suggests `global.prisma`).
 */

declare global {
   
  var __queryClient: ReturnType<typeof postgres> | undefined;
   
  var __db: ReturnType<typeof drizzle> | undefined;
}

const connectionString = process.env.DATABASE_URL!;

// Re-use or create a single query client (uses Postgres.js built-in pooling)
const queryClient =
  global.__queryClient ??
  postgres(connectionString, {
    idle_timeout: 30, // seconds to keep idle connection alive
    max_lifetime: 60 * 60, // close after 1h to avoid stale
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