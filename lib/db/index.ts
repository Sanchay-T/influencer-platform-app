import dotenv from 'dotenv';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { systemLogger } from '@/lib/logging';
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

	var __db: PostgresJsDatabase<typeof schema> | undefined;
}

function resolveDatabaseUrl(): string {
	if (process.env.DATABASE_URL) {
		return process.env.DATABASE_URL;
	}

	try {
		const candidates = ['.env.local', '.env.development', '.env'];
		for (const path of candidates) {
			const result = dotenv.config({ path });
			if (result.parsed) {
				for (const [key, value] of Object.entries(result.parsed)) {
					if (process.env[key] === undefined) {
						process.env[key] = value;
					}
				}
				if (result.parsed.DATABASE_URL) {
					return result.parsed.DATABASE_URL;
				}
			}
		}
	} catch {
		// ignore, will throw below if still missing
	}

	throw new Error(
		'DATABASE_URL environment variable is required but was not found. ' +
			'Define it in your runtime environment or .env.local/.env.development.'
	);
}

const connectionString = resolveDatabaseUrl();

// Environment detection
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

function summarizeConnection(target: string) {
	try {
		const url = new URL(target);
		return {
			protocol: url.protocol.replace(':', ''),
			host: url.host,
			database: url.pathname.replace(/^\//, ''),
		};
	} catch {
		return {
			protocol: target.split(':')[0] ?? 'unknown',
			host: 'unparseable',
			database: 'unparseable',
		};
	}
}

const createdNewClient = !global.__queryClient;

// Re-use or create a single query client (uses Postgres.js built-in pooling)
const queryClient =
	global.__queryClient ??
	postgres(connectionString, {
		// Local development settings vs production
		idle_timeout: isLocal ? 120 : 20, // Shorter timeout for serverless (release connections faster)
		max_lifetime: isLocal ? 60 * 60 * 2 : 60 * 5, // 5min max lifetime in serverless (prevents stale connections)
		max: isLocal ? 10 : 1, // CRITICAL: 1 connection per serverless instance (many instances = many connections)
		connect_timeout: 30, // Always 30s - handles cross-region latency (Vercel → US East Supabase)
	});

if (!global.__queryClient) global.__queryClient = queryClient;

// Note: We only use Supabase for database hosting, auth is handled by Clerk

// Re-use Drizzle ORM wrapper as well
export const db: PostgresJsDatabase<typeof schema> =
	global.__db ??
	drizzle(queryClient, {
		schema: {
			...schema,
			scrapingJobsRelations: schema.scrapingJobsRelations,
			scrapingResultsRelations: schema.scrapingResultsRelations,
		},
	});

if (!global.__db) global.__db = db; // cache for later lambdas

if (createdNewClient && process.env.NODE_ENV !== 'production') {
	const summary = summarizeConnection(connectionString);
	systemLogger.debug('Database pool initialised', {
		environment: isLocal ? 'local' : 'remote',
		host: summary.host,
		database: summary.database,
		pool: {
			idleTimeout: isLocal ? 120 : 20,
			maxLifetime: isLocal ? 60 * 60 * 2 : 60 * 5,
			maxConnections: isLocal ? 10 : 1,
		},
	});
}

/**
 * Retry wrapper for database operations with exponential backoff.
 *
 * @context Handles transient connection failures that occur during cold starts
 * or traffic spikes when connection pool is exhausted.
 *
 * @param fn - Async function that performs the database operation
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Result of the database operation
 * @throws Original error after all retries exhausted
 */
export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
	const retryableErrors = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'connection_refused'];

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error: unknown) {
			const errorCode =
				error instanceof Error && 'code' in error ? (error as { code: string }).code : '';
			const errorMessage = error instanceof Error ? error.message : String(error);

			const isRetryable =
				retryableErrors.some((code) => errorCode === code) ||
				retryableErrors.some((msg) => errorMessage.toLowerCase().includes(msg));

			if (!isRetryable || attempt === maxRetries - 1) {
				throw error;
			}

			const delayMs = 1000 * (attempt + 1); // 1s, 2s, 3s backoff
			systemLogger.warn(`Database connection failed, retrying in ${delayMs}ms`, {
				attempt: attempt + 1,
				maxRetries,
				errorCode,
				errorMessage: errorMessage.slice(0, 100),
			});

			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	// TypeScript requires this, but we'll never reach here
	throw new Error('Unexpected: withDbRetry exhausted all attempts');
}
