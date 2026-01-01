#!/usr/bin/env python3
"""
Database Schema Comparison Script
Compares UAT and PROD PostgreSQL database schemas
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json
from collections import defaultdict

# Database connection strings
UAT_DB = "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def get_connection(conn_string):
    """Create a database connection"""
    return psycopg2.connect(conn_string, cursor_factory=RealDictCursor)

def get_tables(cursor):
    """Get all tables in public schema"""
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    return [row['table_name'] for row in cursor.fetchall()]

def get_columns(cursor, table_name):
    """Get column details for a table"""
    cursor.execute("""
        SELECT
            column_name,
            data_type,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_nullable,
            column_default,
            udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    return {row['column_name']: dict(row) for row in cursor.fetchall()}

def get_primary_keys(cursor, table_name):
    """Get primary key columns for a table"""
    cursor.execute("""
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE i.indisprimary
        AND n.nspname = 'public'
        AND c.relname = %s
        ORDER BY a.attnum
    """, (table_name,))
    return [row['column_name'] for row in cursor.fetchall()]

def get_foreign_keys(cursor, table_name):
    """Get foreign key constraints for a table"""
    cursor.execute("""
        SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = %s
        ORDER BY tc.constraint_name
    """, (table_name,))
    return {row['constraint_name']: dict(row) for row in cursor.fetchall()}

def get_indexes(cursor, table_name):
    """Get indexes for a table"""
    cursor.execute("""
        SELECT
            i.relname as index_name,
            am.amname as index_type,
            ix.indisunique as is_unique,
            ix.indisprimary as is_primary,
            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relkind = 'r'
        AND n.nspname = 'public'
        AND t.relname = %s
        GROUP BY i.relname, am.amname, ix.indisunique, ix.indisprimary
        ORDER BY i.relname
    """, (table_name,))
    return {row['index_name']: dict(row) for row in cursor.fetchall()}

def get_enums(cursor):
    """Get all enum types"""
    cursor.execute("""
        SELECT
            t.typname as enum_name,
            array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname
    """)
    return {row['enum_name']: row['values'] for row in cursor.fetchall()}

def get_full_schema(conn_string, name):
    """Get complete schema information"""
    print(f"\n{'='*60}")
    print(f"Connecting to {name}...")

    conn = get_connection(conn_string)
    cursor = conn.cursor()

    schema = {
        'tables': {},
        'enums': get_enums(cursor)
    }

    tables = get_tables(cursor)
    print(f"Found {len(tables)} tables")

    for table in tables:
        schema['tables'][table] = {
            'columns': get_columns(cursor, table),
            'primary_keys': get_primary_keys(cursor, table),
            'foreign_keys': get_foreign_keys(cursor, table),
            'indexes': get_indexes(cursor, table)
        }

    cursor.close()
    conn.close()

    return schema

def compare_columns(uat_cols, prod_cols, table_name):
    """Compare columns between two tables"""
    differences = []

    uat_names = set(uat_cols.keys())
    prod_names = set(prod_cols.keys())

    # Columns only in UAT
    for col in uat_names - prod_names:
        differences.append(f"  ❌ Column '{col}' exists in UAT but NOT in PROD")

    # Columns only in PROD
    for col in prod_names - uat_names:
        differences.append(f"  ✅ Column '{col}' exists in PROD but NOT in UAT (needs to be added)")

    # Compare common columns
    for col in uat_names & prod_names:
        uat_col = uat_cols[col]
        prod_col = prod_cols[col]

        # Compare data type
        if uat_col['data_type'] != prod_col['data_type'] or uat_col['udt_name'] != prod_col['udt_name']:
            differences.append(
                f"  ⚠️  Column '{col}' type differs: UAT={uat_col['udt_name']} vs PROD={prod_col['udt_name']}"
            )

        # Compare nullability
        if uat_col['is_nullable'] != prod_col['is_nullable']:
            differences.append(
                f"  ⚠️  Column '{col}' nullable differs: UAT={uat_col['is_nullable']} vs PROD={prod_col['is_nullable']}"
            )

        # Compare defaults (simplified)
        uat_default = uat_col['column_default']
        prod_default = prod_col['column_default']
        if str(uat_default) != str(prod_default):
            differences.append(
                f"  ⚠️  Column '{col}' default differs: UAT={uat_default} vs PROD={prod_default}"
            )

    return differences

def compare_schemas(uat_schema, prod_schema):
    """Compare two database schemas"""
    print("\n" + "="*60)
    print("SCHEMA COMPARISON RESULTS")
    print("="*60)

    uat_tables = set(uat_schema['tables'].keys())
    prod_tables = set(prod_schema['tables'].keys())

    # Tables only in UAT
    uat_only = uat_tables - prod_tables
    if uat_only:
        print(f"\n❌ Tables in UAT but NOT in PROD ({len(uat_only)}):")
        for t in sorted(uat_only):
            print(f"   - {t}")

    # Tables only in PROD
    prod_only = prod_tables - uat_tables
    if prod_only:
        print(f"\n✅ Tables in PROD but NOT in UAT ({len(prod_only)}) - NEED TO ADD:")
        for t in sorted(prod_only):
            print(f"   - {t}")

    # Common tables with differences
    common_tables = uat_tables & prod_tables
    print(f"\n📊 Comparing {len(common_tables)} common tables...")

    tables_with_diffs = []

    for table in sorted(common_tables):
        uat_table = uat_schema['tables'][table]
        prod_table = prod_schema['tables'][table]

        diffs = []

        # Compare columns
        col_diffs = compare_columns(uat_table['columns'], prod_table['columns'], table)
        diffs.extend(col_diffs)

        # Compare primary keys
        if uat_table['primary_keys'] != prod_table['primary_keys']:
            diffs.append(
                f"  ⚠️  Primary keys differ: UAT={uat_table['primary_keys']} vs PROD={prod_table['primary_keys']}"
            )

        # Compare indexes (simplified)
        uat_idx = set(uat_table['indexes'].keys())
        prod_idx = set(prod_table['indexes'].keys())

        for idx in prod_idx - uat_idx:
            diffs.append(f"  ✅ Index '{idx}' exists in PROD but NOT in UAT")

        for idx in uat_idx - prod_idx:
            diffs.append(f"  ❌ Index '{idx}' exists in UAT but NOT in PROD")

        if diffs:
            tables_with_diffs.append((table, diffs))

    # Print table differences
    if tables_with_diffs:
        print(f"\n{'='*60}")
        print("DETAILED TABLE DIFFERENCES")
        print("="*60)

        for table, diffs in tables_with_diffs:
            print(f"\n📋 Table: {table}")
            for diff in diffs:
                print(diff)
    else:
        print("\n✅ All common tables have identical schemas!")

    # Compare enums
    uat_enums = set(uat_schema['enums'].keys())
    prod_enums = set(prod_schema['enums'].keys())

    if uat_enums != prod_enums or uat_schema['enums'] != prod_schema['enums']:
        print(f"\n{'='*60}")
        print("ENUM DIFFERENCES")
        print("="*60)

        for enum in prod_enums - uat_enums:
            print(f"  ✅ Enum '{enum}' exists in PROD but NOT in UAT: {prod_schema['enums'][enum]}")

        for enum in uat_enums - prod_enums:
            print(f"  ❌ Enum '{enum}' exists in UAT but NOT in PROD")

        for enum in uat_enums & prod_enums:
            if uat_schema['enums'][enum] != prod_schema['enums'][enum]:
                print(f"  ⚠️  Enum '{enum}' values differ:")
                print(f"      UAT:  {uat_schema['enums'][enum]}")
                print(f"      PROD: {prod_schema['enums'][enum]}")

    return {
        'uat_only_tables': list(uat_only),
        'prod_only_tables': list(prod_only),
        'tables_with_differences': [(t, d) for t, d in tables_with_diffs]
    }

def main():
    print("Database Schema Comparison Tool")
    print("UAT = Target (what you want to match TO)")
    print("PROD = Source (the current production schema)")

    # Get schemas
    uat_schema = get_full_schema(UAT_DB, "UAT")
    prod_schema = get_full_schema(PROD_DB, "PROD")

    # Compare
    results = compare_schemas(uat_schema, prod_schema)

    # Save detailed output
    output = {
        'uat_tables': list(uat_schema['tables'].keys()),
        'prod_tables': list(prod_schema['tables'].keys()),
        'uat_enums': uat_schema['enums'],
        'prod_enums': prod_schema['enums'],
        'comparison': results
    }

    with open('schema-comparison-output.json', 'w') as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\n{'='*60}")
    print("Full comparison saved to: schema-comparison-output.json")
    print("="*60)

if __name__ == "__main__":
    main()
