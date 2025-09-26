const { Client } = require('pg');

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main() {
  const dbUrl = env('DATABASE_URL');
  const ssl = /supabase|amazonaws|pooler|\.co:/.test(dbUrl);
  const client = new Client({ connectionString: dbUrl, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    console.log('Connected to:', dbUrl.replace(/\/\/.*@/, '//***@'));
    // Schemas
    const schemas = await client.query("select schema_name from information_schema.schemata order by schema_name");
    console.log('Schemas:', schemas.rows.map(r=>r.schema_name).join(', '));

    // Tables in public
    const tablesRes = await client.query("select table_name from information_schema.tables where table_schema='public' order by table_name");
    const tables = tablesRes.rows.map(r=>r.table_name);
    console.log('Public tables:', tables.join(', '));

    // Roles (anon/authenticated/service_role if Supabase)
    const rolesRes = await client.query("select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname");
    console.log('Supabase roles present:', rolesRes.rows.map(r=>r.rolname).join(', ') || 'none');

    // RLS policies
    const policiesRes = await client.query("select schemaname, tablename, policyname, permissive as perm, roles from pg_policies where schemaname='public' order by tablename, policyname");
    console.log('RLS policies count:', policiesRes.rowCount);

    // Key tables details
    const keyTables = ['user_profiles','subscription_plans','campaigns','scraping_jobs','scraping_results','events','background_jobs','system_configurations'];
    for (const t of keyTables) {
      if (!tables.includes(t)) continue;
      const cols = await client.query(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='${t}' order by ordinal_position`);
      const cnt = await client.query(`select count(*) from ${t}`);
      console.log(`\nTable: ${t} (rows: ${cnt.rows[0].count})`);
      cols.rows.forEach(c => console.log(` - ${c.column_name} ${c.data_type} ${c.is_nullable==='NO'?'NOT NULL':''} ${c.column_default?('DEFAULT '+c.column_default):''}`));
    }

  } finally {
    await client.end();
  }
}

require('dotenv').config({ path: '.env.local' });
main().catch(e=>{ console.error(e); process.exit(1); });

