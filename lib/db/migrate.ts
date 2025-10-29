import { structuredConsole } from '@/lib/logging/console-proxy';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigrations = async () => {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  structuredConsole.log('Running migrations...');
  
  await migrate(db, { migrationsFolder: 'supabase/migrations' });
  
  structuredConsole.log('Migrations completed!');
  await sql.end();
};

runMigrations().catch((err) => {
  structuredConsole.error('Migration failed!', err);
  process.exit(1);
}); 
