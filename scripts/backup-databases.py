#!/usr/bin/env python3
"""
Database Backup Script - Creates complete backups of UAT and PROD databases
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
import os

UAT_DB = "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def get_connection(conn_string):
    return psycopg2.connect(conn_string, cursor_factory=RealDictCursor)

def get_complete_schema(cursor):
    """Get complete database schema"""
    schema = {}

    # Get all tables
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    tables = [row['table_name'] for row in cursor.fetchall()]
    schema['tables'] = {}

    for table in tables:
        # Get columns
        cursor.execute("""
            SELECT
                column_name, ordinal_position, column_default, is_nullable,
                data_type, udt_name, character_maximum_length,
                numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
        """, (table,))
        columns = [dict(row) for row in cursor.fetchall()]

        # Get indexes
        cursor.execute("""
            SELECT
                i.relname as index_name,
                am.amname as index_type,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                pg_get_indexdef(ix.indexrelid) as definition
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_am am ON i.relam = am.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relkind = 'r' AND n.nspname = 'public' AND t.relname = %s
            ORDER BY i.relname
        """, (table,))
        indexes = [dict(row) for row in cursor.fetchall()]

        # Get constraints
        cursor.execute("""
            SELECT
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            LEFT JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = %s
            ORDER BY tc.constraint_name
        """, (table,))
        constraints = [dict(row) for row in cursor.fetchall()]

        # Get row count
        cursor.execute(f'SELECT COUNT(*) as count FROM "{table}"')
        row_count = cursor.fetchone()['count']

        schema['tables'][table] = {
            'columns': columns,
            'indexes': indexes,
            'constraints': constraints,
            'row_count': row_count
        }

    # Get enums
    cursor.execute("""
        SELECT t.typname as enum_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
    """)
    schema['enums'] = {row['enum_name']: row['values'] for row in cursor.fetchall()}

    # Get sequences
    cursor.execute("""
        SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    """)
    schema['sequences'] = [dict(row) for row in cursor.fetchall()]

    # Get views
    cursor.execute("""
        SELECT table_name, view_definition
        FROM information_schema.views
        WHERE table_schema = 'public'
    """)
    schema['views'] = [dict(row) for row in cursor.fetchall()]

    # Get functions
    cursor.execute("""
        SELECT p.proname as name, pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    """)
    schema['functions'] = [dict(row) for row in cursor.fetchall()]

    # Get triggers
    cursor.execute("""
        SELECT trigger_name, event_manipulation, event_object_table, action_statement, action_timing
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    """)
    schema['triggers'] = [dict(row) for row in cursor.fetchall()]

    return schema

def get_table_data(cursor, table_name, limit=None):
    """Get all data from a table"""
    query = f'SELECT * FROM "{table_name}"'
    if limit:
        query += f' LIMIT {limit}'
    cursor.execute(query)
    return [dict(row) for row in cursor.fetchall()]

def backup_database(conn_string, name, backup_dir):
    """Backup a complete database"""
    print(f"\n{'='*60}")
    print(f"Backing up {name}...")
    print("="*60)

    conn = get_connection(conn_string)
    cursor = conn.cursor()

    # Get schema
    print("  Getting schema...")
    schema = get_complete_schema(cursor)

    # Get data for all tables
    print("  Exporting table data...")
    data = {}
    for table in schema['tables']:
        row_count = schema['tables'][table]['row_count']
        print(f"    - {table}: {row_count} rows")
        if row_count > 0:
            data[table] = get_table_data(cursor, table)
        else:
            data[table] = []

    cursor.close()
    conn.close()

    # Create backup files
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Save schema
    schema_file = os.path.join(backup_dir, f"{name.lower()}_schema_{timestamp}.json")
    with open(schema_file, 'w') as f:
        json.dump(schema, f, indent=2, default=str)
    print(f"  Schema saved: {schema_file}")

    # Save data
    data_file = os.path.join(backup_dir, f"{name.lower()}_data_{timestamp}.json")
    with open(data_file, 'w') as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Data saved: {data_file}")

    return schema_file, data_file

def main():
    # Create backup directory
    backup_dir = "database-backups"
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'='*60}")
    print(f"DATABASE BACKUP - {timestamp}")
    print("="*60)

    # Backup both databases
    uat_schema, uat_data = backup_database(UAT_DB, "UAT", backup_dir)
    prod_schema, prod_data = backup_database(PROD_DB, "PROD", backup_dir)

    print(f"\n{'='*60}")
    print("BACKUP COMPLETE")
    print("="*60)
    print(f"\nBackup files saved to: {backup_dir}/")
    print("\nFiles created:")
    print(f"  - {uat_schema}")
    print(f"  - {uat_data}")
    print(f"  - {prod_schema}")
    print(f"  - {prod_data}")

if __name__ == "__main__":
    main()
