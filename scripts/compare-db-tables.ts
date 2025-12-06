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

interface TableInfo {
  table_name: string;
  column_count: number;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

async function getTablesFromDB(databaseUrl: string): Promise<TableInfo[]> {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const tables = await sql`
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    return tables.map(t => ({
      table_name: t.table_name,
      column_count: Number(t.column_count)
    }));
  } catch (error) {
    console.error(`${colors.red}❌ Error querying database:${colors.reset}`, error);
    throw error;
  } finally {
    await sql.end();
  }
}

async function getTableColumns(databaseUrl: string, tableName: string): Promise<ColumnInfo[]> {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const columns = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
      ORDER BY ordinal_position;
    `;

    return columns as ColumnInfo[];
  } catch (error) {
    console.error(`${colors.red}❌ Error querying columns:${colors.reset}`, error);
    throw error;
  } finally {
    await sql.end();
  }
}

async function compareTableStructure(
  devUrl: string,
  prodUrl: string,
  tableName: string
): Promise<{ missing: string[]; extra: string[]; different: string[] }> {
  const devColumns = await getTableColumns(devUrl, tableName);
  const prodColumns = await getTableColumns(prodUrl, tableName);

  const devColNames = new Set(devColumns.map(c => c.column_name));
  const prodColNames = new Set(prodColumns.map(c => c.column_name));

  const missing = devColumns.filter(c => !prodColNames.has(c.column_name)).map(c => c.column_name);
  const extra = prodColumns.filter(c => !devColNames.has(c.column_name)).map(c => c.column_name);
  const different: string[] = [];

  // Check for columns with different types
  for (const devCol of devColumns) {
    const prodCol = prodColumns.find(c => c.column_name === devCol.column_name);
    if (prodCol && devCol.data_type !== prodCol.data_type) {
      different.push(`${devCol.column_name} (dev: ${devCol.data_type}, prod: ${prodCol.data_type})`);
    }
  }

  return { missing, extra, different };
}

async function compareDatabases() {
  console.log(`\n${colors.bold}${colors.cyan}🔍 Database Table Comparison Tool${colors.reset}\n`);

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

  // Get tables from both databases
  console.log(`${colors.cyan}🔍 Fetching tables from development database...${colors.reset}`);
  const devTables = await getTablesFromDB(devDbUrl);
  console.log(`${colors.green}✓ Development has ${devTables.length} tables${colors.reset}\n`);

  console.log(`${colors.cyan}🔍 Fetching tables from production database...${colors.reset}`);
  const prodTables = await getTablesFromDB(prodDbUrl);
  console.log(`${colors.green}✓ Production has ${prodTables.length} tables${colors.reset}\n`);

  // Compare tables
  const devTableNames = new Set(devTables.map(t => t.table_name));
  const prodTableNames = new Set(prodTables.map(t => t.table_name));

  const missingInProd = devTables.filter(t => !prodTableNames.has(t.table_name));
  const extraInProd = prodTables.filter(t => !devTableNames.has(t.table_name));
  const commonTables = devTables.filter(t => prodTableNames.has(t.table_name));

  // Display results
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}                    COMPARISON RESULTS${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

  if (missingInProd.length === 0 && extraInProd.length === 0) {
    console.log(`${colors.green}${colors.bold}✅ Both databases have the same tables!${colors.reset}\n`);
  }

  if (missingInProd.length > 0) {
    console.log(`${colors.red}${colors.bold}⚠️  ${missingInProd.length} table(s) in DEVELOPMENT but NOT in PRODUCTION:${colors.reset}\n`);
    missingInProd.forEach((table, index) => {
      console.log(`${colors.yellow}${index + 1}. ${table.table_name}${colors.reset} (${table.column_count} columns)`);
    });
    console.log('');
  }

  if (extraInProd.length > 0) {
    console.log(`${colors.yellow}${colors.bold}ℹ️  ${extraInProd.length} table(s) in PRODUCTION but NOT in DEVELOPMENT:${colors.reset}\n`);
    extraInProd.forEach((table, index) => {
      console.log(`${colors.yellow}${index + 1}. ${table.table_name}${colors.reset} (${table.column_count} columns)`);
    });
    console.log('');
  }

  if (commonTables.length > 0) {
    console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}           COMMON TABLES (${commonTables.length})${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

    for (const table of commonTables) {
      const prodTable = prodTables.find(t => t.table_name === table.table_name)!;

      if (table.column_count !== prodTable.column_count) {
        console.log(`${colors.yellow}📋 ${table.table_name}${colors.reset} - ${colors.red}Column count mismatch${colors.reset} (dev: ${table.column_count}, prod: ${prodTable.column_count})`);

        // Get detailed column differences
        const diff = await compareTableStructure(devDbUrl, prodDbUrl, table.table_name);

        if (diff.missing.length > 0) {
          console.log(`   ${colors.red}Missing in prod:${colors.reset} ${diff.missing.join(', ')}`);
        }
        if (diff.extra.length > 0) {
          console.log(`   ${colors.yellow}Extra in prod:${colors.reset} ${diff.extra.join(', ')}`);
        }
        if (diff.different.length > 0) {
          console.log(`   ${colors.yellow}Different types:${colors.reset} ${diff.different.join(', ')}`);
        }
        console.log('');
      } else {
        console.log(`${colors.green}✓ ${table.table_name}${colors.reset} (${table.column_count} columns)`);
      }
    }
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}                      SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.blue}Development:${colors.reset} ${devTables.length} tables`);
  console.log(`${colors.blue}Production:${colors.reset} ${prodTables.length} tables`);
  console.log(`${colors.green}Common:${colors.reset} ${commonTables.length} tables`);
  console.log(`${colors.red}Missing in prod:${colors.reset} ${missingInProd.length} tables`);
  console.log(`${colors.yellow}Extra in prod:${colors.reset} ${extraInProd.length} tables\n`);

  if (missingInProd.length > 0) {
    console.log(`${colors.red}${colors.bold}⚠️  Production database is missing tables!${colors.reset}`);
    console.log(`${colors.yellow}This suggests migrations need to be applied to production.${colors.reset}\n`);
  }
}

// Run the comparison
compareDatabases().catch(error => {
  console.error(`${colors.red}❌ Fatal error:${colors.reset}`, error);
  process.exit(1);
});
