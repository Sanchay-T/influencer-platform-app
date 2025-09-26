import { drizzle } from 'drizzle-orm/postgres-js';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Cliente para consultas
const queryClient = postgres(connectionString);

// Cliente para Supabase
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cliente Drizzle
export const db = drizzle(queryClient, { 
  schema: {
    ...schema,
    scrapingJobsRelations: schema.scrapingJobsRelations,
    scrapingResultsRelations: schema.scrapingResultsRelations
  }
}); 