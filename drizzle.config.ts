import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// Environment-aware config loading
const envFile = '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log(`🔧 [DRIZZLE CONFIG] Loading environment from: ${envFile}`);
console.log(`🔧 [DRIZZLE CONFIG] Database URL: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'development' ? false : true,
  },
  // Fix for CHECK constraint introspection bug
  introspect: {
    casing: 'preserve',
  },
  // Disable strict mode to avoid CHECK constraint parsing issues
  strict: false,
  verbose: true,
  // Skip problematic introspection during push
  breakpoints: false,
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public'
  }
});