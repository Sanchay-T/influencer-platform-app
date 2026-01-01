#!/usr/bin/env python3
"""
Sync all missing indexes from UAT to PROD
"""

import psycopg2
from psycopg2.extras import RealDictCursor

UAT_DB = "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def get_connection(conn_string):
    return psycopg2.connect(conn_string, cursor_factory=RealDictCursor)

def get_all_indexes(cursor):
    """Get all index definitions"""
    cursor.execute("""
        SELECT
            c.relname as index_name,
            t.relname as table_name,
            pg_get_indexdef(i.indexrelid) as definition
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND NOT i.indisprimary
        ORDER BY t.relname, c.relname
    """)
    return {row['index_name']: row for row in cursor.fetchall()}

def main():
    print("=" * 70)
    print("SYNCING INDEXES FROM UAT TO PROD")
    print("=" * 70)

    # Get indexes from both
    uat_conn = get_connection(UAT_DB)
    uat_cursor = uat_conn.cursor()
    uat_indexes = get_all_indexes(uat_cursor)
    uat_cursor.close()
    uat_conn.close()

    prod_conn = get_connection(PROD_DB)
    prod_cursor = prod_conn.cursor()
    prod_indexes = get_all_indexes(prod_cursor)

    # Find missing indexes
    missing = set(uat_indexes.keys()) - set(prod_indexes.keys())
    print(f"\nFound {len(missing)} indexes to create on PROD\n")

    success = 0
    failed = 0

    for idx_name in sorted(missing):
        idx = uat_indexes[idx_name]
        definition = idx['definition']
        table = idx['table_name']

        print(f"[{idx_name}] on {table}...")

        try:
            prod_cursor.execute(definition)
            prod_conn.commit()
            print(f"  ✅ Created")
            success += 1
        except Exception as e:
            prod_conn.rollback()
            error = str(e).strip()
            if "already exists" in error:
                print(f"  ⚠️  Already exists")
                success += 1
            else:
                print(f"  ❌ Error: {error[:80]}")
                failed += 1

    prod_cursor.close()
    prod_conn.close()

    print("\n" + "=" * 70)
    print(f"COMPLETE: {success} succeeded, {failed} failed")
    print("=" * 70)

if __name__ == "__main__":
    main()
