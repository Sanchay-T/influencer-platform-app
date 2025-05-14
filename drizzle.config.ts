import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// Carga específicamente el archivo .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

/* ssl: process.env.NODE_ENV === 'development' ? false : true, // Deshabilitar SSL en desarrollo
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public' */