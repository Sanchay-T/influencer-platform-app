#!/usr/bin/env python3
"""Check job data on PROD"""

import psycopg2
from psycopg2.extras import RealDictCursor

PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def main():
    conn = psycopg2.connect(PROD_DB, cursor_factory=RealDictCursor)
    cursor = conn.cursor()

    print("=" * 70)
    print("CHECKING JOB DATA ON PROD")
    print("=" * 70)

    # Check job_creators table
    print("\n1. job_creators table:")
    cursor.execute("SELECT COUNT(*) as count FROM job_creators")
    print(f"   Total rows: {cursor.fetchone()['count']}")

    # Check job_creator_keys table
    print("\n2. job_creator_keys table:")
    cursor.execute("SELECT COUNT(*) as count FROM job_creator_keys")
    print(f"   Total rows: {cursor.fetchone()['count']}")

    # Check scraping_jobs
    print("\n3. scraping_jobs (recent 5):")
    cursor.execute("""
        SELECT id, status, platform, keywords, total_creators, created_at
        FROM scraping_jobs
        ORDER BY created_at DESC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"   - {row['id'][:8]}... | {row['status']} | {row['platform']} | creators: {row['total_creators']}")

    # Check scraping_results
    print("\n4. scraping_results (recent 5):")
    cursor.execute("""
        SELECT id, job_id, jsonb_array_length(creators) as creator_count, created_at
        FROM scraping_results
        ORDER BY created_at DESC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"   - job: {row['job_id'][:8]}... | creators in result: {row['creator_count']}")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
