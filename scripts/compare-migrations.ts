import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

interface MigrationRecord {
  hash: string;
  created_at: number;
}

interface MigrationFile {
  filename: string;
  hash: string;
}

async function getMigrationsFromDB(databaseUrl: string): Promise<MigrationRecord[]> {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    // Check if migrations table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '__drizzle_migrations'
      );
    `;

    if (!tableCheck[0].exists) {
      console.log(`${colors.yellow}⚠️  No migrations table found in this database${colors.reset}`);
      return [];
    }

    // Get all applied migrations
    const migrations = await sql`
      SELECT hash, created_at
      FROM __drizzle_migrations
      ORDER BY created_at ASC
    `;

    return migrations as MigrationRecord[];
  } catch (error) {
    console.error(`${colors.red}❌ Error querying database:${colors.reset}`, error);
    throw error;
  } finally {
    await sql.end();
  }
}

function getMigrationFiles(): MigrationFile[] {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  return files.map(filename => {
    const content = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
    // Drizzle uses a simple hash based on the SQL content
    const hash = generateHash(content);
    return { filename, hash };
  });
}

function generateHash(content: string): string {
  // Simple hash generation similar to Drizzle's approach
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

async function compareMigrations() {
  console.log(`\n${colors.bold}${colors.cyan}🔍 Database Migration Comparison Tool${colors.reset}\n`);

  // Load environment files
  const devEnvPath = path.join(process.cwd(), '.env.development');
  const prodEnvPath = path.join(process.cwd(), '.env.production');

  if (!fs.existsSync(devEnvPath) || !fs.existsSync(prodEnvPath)) {
    console.error(`${colors.red}❌ Environment files not found${colors.reset}`);
    return;
  }

  // Parse environment files
  const devEnv = dotenv.parse(fs.readFileSync(devEnvPath));
  const prodEnv = dotenv.parse(fs.readFileSync(prodEnvPath));

  const devDbUrl = devEnv.DATABASE_URL;
  const prodDbUrl = prodEnv.DATABASE_URL;

  if (!devDbUrl || !prodDbUrl) {
    console.error(`${colors.red}❌ DATABASE_URL not found in environment files${colors.reset}`);
    return;
  }

  console.log(`${colors.blue}📦 Development DB:${colors.reset} ${devDbUrl.replace(/\/\/.*@/, '//***@')}`);
  console.log(`${colors.blue}🚀 Production DB:${colors.reset} ${prodDbUrl.replace(/\/\/.*@/, '//***@')}\n`);

  // Get migration files
  console.log(`${colors.cyan}📂 Reading migration files...${colors.reset}`);
  const migrationFiles = getMigrationFiles();
  console.log(`${colors.green}✓ Found ${migrationFiles.length} migration files${colors.reset}\n`);

  // Get applied migrations from both databases
  console.log(`${colors.cyan}🔍 Checking development database...${colors.reset}`);
  const devMigrations = await getMigrationsFromDB(devDbUrl);
  console.log(`${colors.green}✓ Development has ${devMigrations.length} migrations applied${colors.reset}\n`);

  console.log(`${colors.cyan}🔍 Checking production database...${colors.reset}`);
  const prodMigrations = await getMigrationsFromDB(prodDbUrl);
  console.log(`${colors.green}✓ Production has ${prodMigrations.length} migrations applied${colors.reset}\n`);

  // Compare migrations
  const devHashes = new Set(devMigrations.map(m => m.hash));
  const prodHashes = new Set(prodMigrations.map(m => m.hash));

  const missingInProd = devMigrations.filter(m => !prodHashes.has(m.hash));
  const extraInProd = prodMigrations.filter(m => !devHashes.has(m.hash));

  // Display results
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}                    COMPARISON RESULTS${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

  if (missingInProd.length === 0 && extraInProd.length === 0) {
    console.log(`${colors.green}${colors.bold}✅ Databases are in sync!${colors.reset}`);
    console.log(`${colors.green}Both databases have the same migrations applied.${colors.reset}\n`);
    return;
  }

  if (missingInProd.length > 0) {
    console.log(`${colors.red}${colors.bold}⚠️  ${missingInProd.length} migration(s) in DEVELOPMENT but NOT in PRODUCTION:${colors.reset}\n`);

    missingInProd.forEach((migration, index) => {
      // Try to find the corresponding file
      const matchingFile = migrationFiles.find(f => f.hash === migration.hash);
      let dateStr = 'Unknown date';
      if (migration.created_at) {
        try {
          const date = new Date(migration.created_at);
          dateStr = date.toISOString();
        } catch {
          dateStr = `${migration.created_at}`;
        }
      }

      console.log(`${colors.yellow}${index + 1}.${colors.reset} Hash: ${colors.yellow}${migration.hash}${colors.reset}`);
      console.log(`   Applied: ${dateStr}`);
      if (matchingFile) {
        console.log(`   File: ${colors.cyan}${matchingFile.filename}${colors.reset}`);
      } else {
        console.log(`   ${colors.red}⚠️  No matching file found${colors.reset}`);
      }
      console.log('');
    });
  }

  if (extraInProd.length > 0) {
    console.log(`${colors.yellow}${colors.bold}ℹ️  ${extraInProd.length} migration(s) in PRODUCTION but NOT in DEVELOPMENT:${colors.reset}\n`);

    extraInProd.forEach((migration, index) => {
      const matchingFile = migrationFiles.find(f => f.hash === migration.hash);
      let dateStr = 'Unknown date';
      if (migration.created_at) {
        try {
          const date = new Date(migration.created_at);
          dateStr = date.toISOString();
        } catch {
          dateStr = `${migration.created_at}`;
        }
      }

      console.log(`${colors.yellow}${index + 1}.${colors.reset} Hash: ${colors.yellow}${migration.hash}${colors.reset}`);
      console.log(`   Applied: ${dateStr}`);
      if (matchingFile) {
        console.log(`   File: ${colors.cyan}${matchingFile.filename}${colors.reset}`);
      }
      console.log('');
    });
  }

  // Display all migration files with status
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}              ALL MIGRATION FILES${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

  migrationFiles.forEach((file, index) => {
    const inDev = devHashes.has(file.hash);
    const inProd = prodHashes.has(file.hash);

    let status = '';
    if (inDev && inProd) {
      status = `${colors.green}✓ Both${colors.reset}`;
    } else if (inDev && !inProd) {
      status = `${colors.red}✗ Dev only${colors.reset}`;
    } else if (!inDev && inProd) {
      status = `${colors.yellow}! Prod only${colors.reset}`;
    } else {
      status = `${colors.red}✗ Neither${colors.reset}`;
    }

    console.log(`${index + 1}. ${file.filename}`);
    console.log(`   Status: ${status}`);
    console.log(`   Hash: ${file.hash}\n`);
  });

  // Summary and next steps
  if (missingInProd.length > 0) {
    console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}                  NEXT STEPS${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`${colors.yellow}To apply missing migrations to production:${colors.reset}\n`);
    console.log(`1. ${colors.cyan}Review the migration files listed above${colors.reset}`);
    console.log(`2. ${colors.cyan}Run: npm run db:migrate:prod${colors.reset} (you may need to create this script)`);
    console.log(`3. ${colors.cyan}Or manually apply using: tsx scripts/apply-migrations.ts --env production${colors.reset}\n`);

    console.log(`${colors.red}${colors.bold}⚠️  WARNING:${colors.reset}`);
    console.log(`${colors.red}Always backup your production database before applying migrations!${colors.reset}\n`);
  }
}

// Run the comparison
compareMigrations().catch(error => {
  console.error(`${colors.red}❌ Fatal error:${colors.reset}`, error);
  process.exit(1);
});
