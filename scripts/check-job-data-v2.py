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

    # Check scraping_jobs columns
    print("\n1. scraping_jobs columns:")
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'scraping_jobs' AND table_schema = 'public'
    """)
    cols = [r['column_name'] for r in cursor.fetchall()]
    print(f"   {', '.join(cols)}")

    # Check scraping_jobs recent
    print("\n2. scraping_jobs (recent 5):")
    cursor.execute("""
        SELECT id, status, platform, keywords, creators_found, created_at
        FROM scraping_jobs
        ORDER BY created_at DESC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"   - {row['id'][:8]}... | {row['status']} | {row['platform']} | found: {row['creators_found']}")

    # Check scraping_results
    print("\n3. scraping_results (creators stored here?):")
    cursor.execute("""
        SELECT sr.job_id, sj.status, jsonb_array_length(sr.creators) as creator_count
        FROM scraping_results sr
        JOIN scraping_jobs sj ON sr.job_id = sj.id
        ORDER BY sr.created_at DESC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"   - job: {row['job_id'][:8]}... | status: {row['status']} | creators: {row['creator_count']}")

    # Check job_creators (v2)
    print("\n4. job_creators (v2 table - should have data for new runs):")
    cursor.execute("SELECT COUNT(*) as count FROM job_creators")
    count = cursor.fetchone()['count']
    print(f"   Total: {count} rows")

    if count > 0:
        cursor.execute("""
            SELECT job_id, COUNT(*) as count
            FROM job_creators
            GROUP BY job_id
            ORDER BY count DESC
            LIMIT 5
        """)
        for row in cursor.fetchall():
            print(f"   - job: {row['job_id'][:8]}... | {row['count']} creators")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
