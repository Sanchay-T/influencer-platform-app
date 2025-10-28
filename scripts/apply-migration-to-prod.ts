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

interface MigrationResult {
  success: boolean;
  message: string;
  error?: any;
}

async function applyMigrationToProduction(migrationFile: string): Promise<MigrationResult> {
  console.log(`\n${colors.bold}${colors.cyan}🚀 Production Migration Tool${colors.reset}\n`);

  // Load production environment
  const prodEnvPath = path.join(process.cwd(), '.env.production');

  if (!fs.existsSync(prodEnvPath)) {
    return {
      success: false,
      message: `${colors.red}❌ Production environment file not found: ${prodEnvPath}${colors.reset}`
    };
  }

  const prodEnv = dotenv.parse(fs.readFileSync(prodEnvPath));
  const prodDbUrl = prodEnv.DATABASE_URL;

  if (!prodDbUrl) {
    return {
      success: false,
      message: `${colors.red}❌ DATABASE_URL not found in .env.production${colors.reset}`
    };
  }

  console.log(`${colors.blue}🔗 Production DB:${colors.reset} ${prodDbUrl.replace(/\/\/.*@/, '//***@')}\n`);

  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    return {
      success: false,
      message: `${colors.red}❌ Migration file not found: ${migrationPath}${colors.reset}`
    };
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`${colors.cyan}📄 Migration file:${colors.reset} ${migrationFile}`);
  console.log(`${colors.cyan}📝 SQL content:${colors.reset}\n`);
  console.log(`${colors.yellow}${'='.repeat(60)}${colors.reset}`);
  console.log(migrationSql);
  console.log(`${colors.yellow}${'='.repeat(60)}${colors.reset}\n`);

  // Confirm before applying
  console.log(`${colors.yellow}${colors.bold}⚠️  WARNING:${colors.reset}`);
  console.log(`${colors.yellow}This will modify the PRODUCTION database!${colors.reset}`);
  console.log(`${colors.yellow}Press Ctrl+C to cancel or Enter to continue...${colors.reset}\n`);

  // Wait for user confirmation (in a real script, you'd use readline)
  // For now, we'll add a safety check parameter
  const forceApply = process.argv.includes('--force');

  if (!forceApply) {
    console.log(`${colors.red}Migration not applied. Use --force flag to apply:${colors.reset}`);
    console.log(`${colors.cyan}npx tsx scripts/apply-migration-to-prod.ts ${migrationFile} --force${colors.reset}\n`);
    return {
      success: false,
      message: 'Migration cancelled (no --force flag)'
    };
  }

  // Apply migration
  const sql = postgres(prodDbUrl, { max: 1 });

  try {
    console.log(`${colors.cyan}🔧 Applying migration...${colors.reset}`);

    // Execute the migration SQL
    await sql.unsafe(migrationSql);

    console.log(`${colors.green}✓ Migration executed successfully!${colors.reset}\n`);

    // Verify the change
    console.log(`${colors.cyan}🔍 Verifying migration...${colors.reset}`);

    const columnCheck = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_usage'
      AND column_name = 'enrichments_current_month';
    `;

    if (columnCheck.length > 0) {
      console.log(`${colors.green}✓ Column 'enrichments_current_month' verified!${colors.reset}`);
      console.log(`${colors.blue}  Type:${colors.reset} ${columnCheck[0].data_type}`);
      console.log(`${colors.blue}  Default:${colors.reset} ${columnCheck[0].column_default}`);
      console.log(`${colors.blue}  Nullable:${colors.reset} ${columnCheck[0].is_nullable}\n`);
    } else {
      throw new Error('Column verification failed - column not found after migration');
    }

    // Record migration in drizzle migrations table
    console.log(`${colors.cyan}📝 Recording migration in __drizzle_migrations...${colors.reset}`);

    const migrationHash = generateSimpleHash(migrationSql);
    const created_at = Date.now();

    await sql`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (${migrationHash}, ${created_at})
      ON CONFLICT (hash) DO NOTHING;
    `;

    console.log(`${colors.green}✓ Migration recorded in database${colors.reset}\n`);

    await sql.end();

    return {
      success: true,
      message: `${colors.green}${colors.bold}✅ Migration applied successfully!${colors.reset}`
    };

  } catch (error) {
    console.error(`${colors.red}❌ Migration failed:${colors.reset}`, error);
    await sql.end();

    return {
      success: false,
      message: `${colors.red}Migration failed${colors.reset}`,
      error
    };
  }
}

function generateSimpleHash(content: string): string {
  // Simple hash generation similar to Drizzle's approach
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error(`${colors.red}❌ Please specify a migration file${colors.reset}`);
  console.log(`${colors.cyan}Usage: npx tsx scripts/apply-migration-to-prod.ts <migration-file> --force${colors.reset}`);
  console.log(`${colors.cyan}Example: npx tsx scripts/apply-migration-to-prod.ts 0018_add_enrichments_tracking.sql --force${colors.reset}\n`);
  process.exit(1);
}

// Run the migration
applyMigrationToProduction(migrationFile).then(result => {
  console.log(result.message);

  if (!result.success) {
    process.exit(1);
  }

  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}              MIGRATION COMPLETE${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

}).catch(error => {
  console.error(`${colors.red}❌ Fatal error:${colors.reset}`, error);
  process.exit(1);
});
