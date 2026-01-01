#!/usr/bin/env python3
"""Check for duplicate data preventing unique indexes"""

import psycopg2
from psycopg2.extras import RealDictCursor

PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def main():
    conn = psycopg2.connect(PROD_DB, cursor_factory=RealDictCursor)
    cursor = conn.cursor()

    print("=" * 70)
    print("CHECKING DUPLICATE DATA IN PROD")
    print("=" * 70)

    # Check user_billing duplicates
    print("\n1. user_billing.stripe_subscription_id duplicates:")
    cursor.execute("""
        SELECT stripe_subscription_id, COUNT(*) as count, array_agg(user_id) as user_ids
        FROM user_billing
        WHERE stripe_subscription_id IS NOT NULL
        GROUP BY stripe_subscription_id
        HAVING COUNT(*) > 1
    """)
    dups = cursor.fetchall()
    if dups:
        for d in dups:
            print(f"   - '{d['stripe_subscription_id']}': {d['count']} rows, users: {d['user_ids']}")
    else:
        print("   No duplicates found")

    # Check users email duplicates (case-insensitive)
    print("\n2. users.email duplicates (case-insensitive):")
    cursor.execute("""
        SELECT lower(email) as email_lower, COUNT(*) as count, array_agg(id) as user_ids, array_agg(email) as emails
        FROM users
        WHERE email IS NOT NULL
        GROUP BY lower(email)
        HAVING COUNT(*) > 1
    """)
    dups = cursor.fetchall()
    if dups:
        for d in dups:
            print(f"   - '{d['email_lower']}': {d['count']} rows")
            print(f"     IDs: {d['user_ids']}")
            print(f"     Emails: {d['emails']}")
    else:
        print("   No duplicates found")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
