#!/usr/bin/env python3
"""
Get detailed schema info for generating migrations
"""

import psycopg2
from psycopg2.extras import RealDictCursor

PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
UAT_DB = "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

def get_connection(conn_string):
    return psycopg2.connect(conn_string, cursor_factory=RealDictCursor)

def get_column_details(cursor, table_name, column_name):
    """Get full column definition"""
    cursor.execute("""
        SELECT
            column_name,
            data_type,
            udt_name,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = %s
        AND column_name = %s
    """, (table_name, column_name))
    return cursor.fetchone()

def get_index_definition(cursor, index_name):
    """Get CREATE INDEX statement"""
    cursor.execute("""
        SELECT pg_get_indexdef(i.indexrelid) as definition
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = %s
    """, (index_name,))
    result = cursor.fetchone()
    return result['definition'] if result else None

def get_table_ddl(cursor, table_name):
    """Get columns for a table"""
    cursor.execute("""
        SELECT
            column_name,
            data_type,
            udt_name,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    return cursor.fetchall()

def main():
    print("=" * 70)
    print("MIGRATION DETAILS - PROD → UAT")
    print("=" * 70)

    prod_conn = get_connection(PROD_DB)
    prod_cursor = prod_conn.cursor()

    uat_conn = get_connection(UAT_DB)
    uat_cursor = uat_conn.cursor()

    # 1. Get details for columns in PROD but not UAT (scraping_jobs)
    print("\n" + "=" * 70)
    print("COLUMNS TO ADD TO UAT (from PROD)")
    print("=" * 70)

    columns_to_add = [
        ('scraping_jobs', 'parent_job_id'),
        ('scraping_jobs', 'job_kind'),
    ]

    for table, column in columns_to_add:
        col = get_column_details(prod_cursor, table, column)
        if col:
            print(f"\n-- Add column {column} to {table}")
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
            type_str = col['udt_name']
            if col['character_maximum_length']:
                type_str = f"varchar({col['character_maximum_length']})"
            print(f"ALTER TABLE {table} ADD COLUMN {column} {type_str} {nullable}{default};")

    # 2. Get index definitions from PROD
    print("\n" + "=" * 70)
    print("INDEXES TO ADD TO UAT (from PROD)")
    print("=" * 70)

    indexes_to_add = [
        'scraping_jobs_parent_job_id_idx',
    ]

    for idx in indexes_to_add:
        defn = get_index_definition(prod_cursor, idx)
        if defn:
            print(f"\n{defn};")

    # 3. Show columns in UAT that don't exist in PROD (scraping_jobs)
    print("\n" + "=" * 70)
    print("COLUMNS IN UAT NOT IN PROD (may need to remove or are new)")
    print("=" * 70)

    uat_only_columns = [
        ('scraping_jobs', 'keywords_completed'),
        ('scraping_jobs', 'creators_enriched'),
        ('scraping_jobs', 'used_keywords'),
        ('scraping_jobs', 'keywords_dispatched'),
        ('scraping_jobs', 'enrichment_status'),
        ('scraping_jobs', 'creators_found'),
        ('scraping_jobs', 'expansion_round'),
    ]

    for table, column in uat_only_columns:
        col = get_column_details(uat_cursor, table, column)
        if col:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = col['column_default'] or "none"
            print(f"  - {table}.{column}: {col['udt_name']} {nullable}, default={default}")

    # 4. Show tables in UAT that don't exist in PROD
    print("\n" + "=" * 70)
    print("TABLES IN UAT NOT IN PROD (may need to add to PROD)")
    print("=" * 70)

    uat_only_tables = ['webhook_events', 'job_creators', 'job_creator_keys']

    for table in uat_only_tables:
        print(f"\n-- Table: {table}")
        cols = get_table_ddl(uat_cursor, table)
        for col in cols:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
            type_str = col['udt_name']
            if col['character_maximum_length']:
                type_str = f"varchar({col['character_maximum_length']})"
            print(f"    {col['column_name']}: {type_str} {nullable}{default}")

    prod_cursor.close()
    prod_conn.close()
    uat_cursor.close()
    uat_conn.close()

if __name__ == "__main__":
    main()
