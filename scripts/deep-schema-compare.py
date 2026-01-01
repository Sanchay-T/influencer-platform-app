#!/usr/bin/env python3
"""
Deep Database Schema Comparison - catches everything
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json

UAT_DB = "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def get_connection(conn_string):
    return psycopg2.connect(conn_string, cursor_factory=RealDictCursor)

def get_all_constraints(cursor):
    """Get all constraints including unique, check, foreign keys"""
    cursor.execute("""
        SELECT
            tc.table_name,
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            cc.check_clause
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        LEFT JOIN information_schema.check_constraints cc
            ON tc.constraint_name = cc.constraint_name
            AND tc.table_schema = cc.constraint_schema
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name
    """)
    return cursor.fetchall()

def get_sequences(cursor):
    """Get all sequences"""
    cursor.execute("""
        SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
        ORDER BY sequence_name
    """)
    return cursor.fetchall()

def get_views(cursor):
    """Get all views"""
    cursor.execute("""
        SELECT table_name, view_definition
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    return cursor.fetchall()

def get_functions(cursor):
    """Get all functions"""
    cursor.execute("""
        SELECT
            p.proname as function_name,
            pg_get_function_arguments(p.oid) as arguments,
            pg_get_function_result(p.oid) as return_type
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname
    """)
    return cursor.fetchall()

def get_triggers(cursor):
    """Get all triggers"""
    cursor.execute("""
        SELECT
            trigger_name,
            event_manipulation,
            event_object_table,
            action_statement,
            action_timing
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY trigger_name
    """)
    return cursor.fetchall()

def get_all_columns_detailed(cursor):
    """Get all columns with full details"""
    cursor.execute("""
        SELECT
            table_name,
            column_name,
            ordinal_position,
            column_default,
            is_nullable,
            data_type,
            udt_name,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_identity,
            identity_generation
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """)
    results = {}
    for row in cursor.fetchall():
        table = row['table_name']
        if table not in results:
            results[table] = {}
        results[table][row['column_name']] = dict(row)
    return results

def compare_dicts(uat_dict, prod_dict, name):
    """Compare two dictionaries and return differences"""
    uat_keys = set(uat_dict.keys()) if isinstance(uat_dict, dict) else set()
    prod_keys = set(prod_dict.keys()) if isinstance(prod_dict, dict) else set()

    diffs = []
    for key in prod_keys - uat_keys:
        diffs.append(f"  ✅ {name} '{key}' in PROD but NOT in UAT (ADD TO UAT)")
    for key in uat_keys - prod_keys:
        diffs.append(f"  ⚠️  {name} '{key}' in UAT but NOT in PROD")
    return diffs

def main():
    print("=" * 80)
    print("DEEP DATABASE SCHEMA COMPARISON")
    print("=" * 80)

    uat_conn = get_connection(UAT_DB)
    uat_cursor = uat_conn.cursor()

    prod_conn = get_connection(PROD_DB)
    prod_cursor = prod_conn.cursor()

    # 1. Get all columns for all tables
    print("\n" + "=" * 80)
    print("DETAILED COLUMN COMPARISON")
    print("=" * 80)

    uat_cols = get_all_columns_detailed(uat_cursor)
    prod_cols = get_all_columns_detailed(prod_cursor)

    all_tables = set(uat_cols.keys()) | set(prod_cols.keys())

    for table in sorted(all_tables):
        uat_table = uat_cols.get(table, {})
        prod_table = prod_cols.get(table, {})

        if table not in uat_cols:
            print(f"\n✅ Table '{table}' exists in PROD only - ADD TO UAT")
            for col, details in prod_table.items():
                print(f"    {col}: {details['udt_name']}")
            continue

        if table not in prod_cols:
            print(f"\n⚠️  Table '{table}' exists in UAT only")
            continue

        # Compare columns
        diffs = []
        uat_col_names = set(uat_table.keys())
        prod_col_names = set(prod_table.keys())

        for col in prod_col_names - uat_col_names:
            details = prod_table[col]
            diffs.append(f"  ✅ Column '{col}' in PROD only: {details['udt_name']} - ADD TO UAT")

        for col in uat_col_names - prod_col_names:
            details = uat_table[col]
            diffs.append(f"  ⚠️  Column '{col}' in UAT only: {details['udt_name']}")

        # Check for type/constraint differences on common columns
        for col in uat_col_names & prod_col_names:
            uat_c = uat_table[col]
            prod_c = prod_table[col]

            if uat_c['udt_name'] != prod_c['udt_name']:
                diffs.append(f"  ⚠️  Column '{col}' type differs: UAT={uat_c['udt_name']} PROD={prod_c['udt_name']}")

            if uat_c['is_nullable'] != prod_c['is_nullable']:
                diffs.append(f"  ⚠️  Column '{col}' nullable differs: UAT={uat_c['is_nullable']} PROD={prod_c['is_nullable']}")

        if diffs:
            print(f"\n📋 Table: {table}")
            for d in diffs:
                print(d)

    # 2. Compare constraints
    print("\n" + "=" * 80)
    print("CONSTRAINTS COMPARISON")
    print("=" * 80)

    uat_constraints = get_all_constraints(uat_cursor)
    prod_constraints = get_all_constraints(prod_cursor)

    uat_constraint_names = {(c['table_name'], c['constraint_name']) for c in uat_constraints}
    prod_constraint_names = {(c['table_name'], c['constraint_name']) for c in prod_constraints}

    for table, name in prod_constraint_names - uat_constraint_names:
        print(f"  ✅ Constraint '{name}' on '{table}' in PROD only - ADD TO UAT")

    for table, name in uat_constraint_names - prod_constraint_names:
        print(f"  ⚠️  Constraint '{name}' on '{table}' in UAT only")

    if not (prod_constraint_names - uat_constraint_names) and not (uat_constraint_names - prod_constraint_names):
        print("  ✓ All constraints match")

    # 3. Compare sequences
    print("\n" + "=" * 80)
    print("SEQUENCES COMPARISON")
    print("=" * 80)

    uat_seqs = {s['sequence_name']: s for s in get_sequences(uat_cursor)}
    prod_seqs = {s['sequence_name']: s for s in get_sequences(prod_cursor)}

    for seq in set(prod_seqs.keys()) - set(uat_seqs.keys()):
        print(f"  ✅ Sequence '{seq}' in PROD only - ADD TO UAT")

    for seq in set(uat_seqs.keys()) - set(prod_seqs.keys()):
        print(f"  ⚠️  Sequence '{seq}' in UAT only")

    if not (set(prod_seqs.keys()) - set(uat_seqs.keys())) and not (set(uat_seqs.keys()) - set(prod_seqs.keys())):
        print("  ✓ All sequences match")

    # 4. Compare views
    print("\n" + "=" * 80)
    print("VIEWS COMPARISON")
    print("=" * 80)

    uat_views = {v['table_name']: v for v in get_views(uat_cursor)}
    prod_views = {v['table_name']: v for v in get_views(prod_cursor)}

    for view in set(prod_views.keys()) - set(uat_views.keys()):
        print(f"  ✅ View '{view}' in PROD only - ADD TO UAT")

    for view in set(uat_views.keys()) - set(prod_views.keys()):
        print(f"  ⚠️  View '{view}' in UAT only")

    if not (set(prod_views.keys()) - set(uat_views.keys())) and not (set(uat_views.keys()) - set(prod_views.keys())):
        print("  ✓ All views match")

    # 5. Compare functions
    print("\n" + "=" * 80)
    print("FUNCTIONS COMPARISON")
    print("=" * 80)

    uat_funcs = {f['function_name']: f for f in get_functions(uat_cursor)}
    prod_funcs = {f['function_name']: f for f in get_functions(prod_cursor)}

    for func in set(prod_funcs.keys()) - set(uat_funcs.keys()):
        print(f"  ✅ Function '{func}' in PROD only - ADD TO UAT")

    for func in set(uat_funcs.keys()) - set(prod_funcs.keys()):
        print(f"  ⚠️  Function '{func}' in UAT only")

    if not (set(prod_funcs.keys()) - set(uat_funcs.keys())) and not (set(uat_funcs.keys()) - set(prod_funcs.keys())):
        print("  ✓ All functions match")

    # 6. Compare triggers
    print("\n" + "=" * 80)
    print("TRIGGERS COMPARISON")
    print("=" * 80)

    uat_triggers = {t['trigger_name']: t for t in get_triggers(uat_cursor)}
    prod_triggers = {t['trigger_name']: t for t in get_triggers(prod_cursor)}

    for trigger in set(prod_triggers.keys()) - set(uat_triggers.keys()):
        print(f"  ✅ Trigger '{trigger}' in PROD only - ADD TO UAT")

    for trigger in set(uat_triggers.keys()) - set(prod_triggers.keys()):
        print(f"  ⚠️  Trigger '{trigger}' in UAT only")

    if not (set(prod_triggers.keys()) - set(uat_triggers.keys())) and not (set(uat_triggers.keys()) - set(prod_triggers.keys())):
        print("  ✓ All triggers match")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY - WHAT NEEDS TO BE ADDED TO PROD (from UAT)")
    print("=" * 80)

    print("\nTo deploy UAT code to PROD, you need to add these to PROD:")

    # Tables in UAT but not PROD
    uat_tables = set(uat_cols.keys())
    prod_tables = set(prod_cols.keys())

    tables_to_add = uat_tables - prod_tables
    if tables_to_add:
        print(f"\n🔸 Tables to CREATE on PROD ({len(tables_to_add)}):")
        for t in sorted(tables_to_add):
            if not t.startswith('__'):
                print(f"   - {t}")

    # Columns in UAT but not PROD
    cols_to_add = []
    for table in uat_tables & prod_tables:
        uat_table = uat_cols.get(table, {})
        prod_table = prod_cols.get(table, {})
        for col in set(uat_table.keys()) - set(prod_table.keys()):
            cols_to_add.append((table, col, uat_table[col]))

    if cols_to_add:
        print(f"\n🔸 Columns to ADD on PROD ({len(cols_to_add)}):")
        for table, col, details in cols_to_add:
            nullable = "NULL" if details['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {details['column_default']}" if details['column_default'] else ""
            print(f"   - {table}.{col}: {details['udt_name']} {nullable}{default}")

    uat_cursor.close()
    uat_conn.close()
    prod_cursor.close()
    prod_conn.close()

    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
