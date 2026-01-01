#!/usr/bin/env python3
"""Fix duplicate data and create remaining indexes"""

import psycopg2
from psycopg2.extras import RealDictCursor

PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def main():
    conn = psycopg2.connect(PROD_DB, cursor_factory=RealDictCursor)
    cursor = conn.cursor()

    print("=" * 70)
    print("FIXING DUPLICATES IN PROD")
    print("=" * 70)

    # 1. Find older duplicate user and delete
    print("\n1. Finding duplicate users...")
    cursor.execute("""
        SELECT id, email, created_at
        FROM users
        WHERE lower(email) = 'sanchaythalnerkar@gmail.com'
        ORDER BY created_at ASC
    """)
    users = cursor.fetchall()

    if len(users) >= 2:
        older_user = users[0]
        newer_user = users[1]
        print(f"   Older: {older_user['id']} (created: {older_user['created_at']})")
        print(f"   Newer: {newer_user['id']} (created: {newer_user['created_at']})")

        older_id = older_user['id']

        # Delete related data first (foreign key constraints)
        print(f"\n   Deleting older user {older_id} and related data...")

        # Delete from tables with user_id column
        user_id_tables = [
            'user_billing',
            'user_subscriptions',
            'user_system_data',
            'user_usage',
            'user_profiles',
        ]

        for table in user_id_tables:
            try:
                cursor.execute(f"DELETE FROM {table} WHERE user_id = %s", (older_id,))
                deleted = cursor.rowcount
                if deleted > 0:
                    print(f"   - Deleted {deleted} rows from {table}")
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"   - {table}: {e}")

        # Delete from tables with owner_id column
        try:
            cursor.execute("DELETE FROM campaigns WHERE user_id = %s", (older_id,))
            deleted = cursor.rowcount
            if deleted > 0:
                print(f"   - Deleted {deleted} rows from campaigns")
            conn.commit()
        except Exception as e:
            conn.rollback()

        try:
            cursor.execute("DELETE FROM creator_lists WHERE owner_id = %s", (older_id,))
            deleted = cursor.rowcount
            if deleted > 0:
                print(f"   - Deleted {deleted} rows from creator_lists")
            conn.commit()
        except Exception as e:
            conn.rollback()

        # Delete the user
        cursor.execute("DELETE FROM users WHERE id = %s", (older_id,))
        print(f"   ✅ Deleted user {older_id}")
        conn.commit()
    else:
        print("   No duplicate users found")

    # 2. Rename duplicate subscription ID
    print("\n2. Fixing duplicate subscription ID...")
    cursor.execute("""
        SELECT id, user_id, stripe_subscription_id, created_at
        FROM user_billing
        WHERE stripe_subscription_id = 'manual_fame_flex'
        ORDER BY created_at ASC
    """)
    billings = cursor.fetchall()

    if len(billings) >= 2:
        # Rename the older one
        older_billing = billings[0]
        print(f"   Renaming subscription for user {older_billing['user_id']}...")
        cursor.execute("""
            UPDATE user_billing
            SET stripe_subscription_id = 'manual_fame_flex_legacy'
            WHERE id = %s
        """, (older_billing['id'],))
        print(f"   ✅ Renamed to 'manual_fame_flex_legacy'")
        conn.commit()
    else:
        print("   No duplicate subscriptions found")

    # 3. Create the remaining indexes
    print("\n3. Creating remaining unique indexes...")

    indexes = [
        "CREATE UNIQUE INDEX IF NOT EXISTS user_billing_stripe_subscription_id_unique ON user_billing(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_unique ON users(lower(email))",
    ]

    for idx_sql in indexes:
        idx_name = idx_sql.split("EXISTS")[1].split("ON")[0].strip()
        print(f"   Creating {idx_name}...")
        try:
            cursor.execute(idx_sql)
            conn.commit()
            print(f"   ✅ Created")
        except Exception as e:
            conn.rollback()
            print(f"   ❌ Error: {e}")

    cursor.close()
    conn.close()

    print("\n" + "=" * 70)
    print("DONE")
    print("=" * 70)

if __name__ == "__main__":
    main()
