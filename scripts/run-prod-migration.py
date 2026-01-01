#!/usr/bin/env python3
"""
Run migrations on PROD database to match UAT schema
"""

import psycopg2
from psycopg2.extras import RealDictCursor

PROD_DB = "postgresql://postgres.rpngfxpzkoitpmcokehp:pMmXORMrClLWwX8T@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

MIGRATIONS = [
    # 1. Create webhook_events table
    """
    CREATE TABLE IF NOT EXISTS webhook_events (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        event_id text NOT NULL,
        source varchar(20) NOT NULL,
        event_type varchar(100) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'processing',
        event_timestamp timestamp NULL,
        processed_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        error_message text NULL,
        retry_count int4 NOT NULL DEFAULT 0,
        payload jsonb NULL,
        metadata jsonb NULL
    )
    """,

    # 2. Create job_creators table
    """
    CREATE TABLE IF NOT EXISTS job_creators (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        job_id uuid NOT NULL,
        platform varchar(50) NOT NULL,
        username varchar(255) NOT NULL,
        creator_data jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        enriched bool NOT NULL DEFAULT false
    )
    """,

    # 3. Create job_creator_keys table
    """
    CREATE TABLE IF NOT EXISTS job_creator_keys (
        job_id uuid NOT NULL,
        creator_key text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (job_id, creator_key)
    )
    """,

    # 4. Add columns to scraping_jobs
    "ALTER TABLE scraping_jobs ADD COLUMN IF NOT EXISTS keywords_completed int4 NULL DEFAULT 0",
    "ALTER TABLE scraping_jobs ADD COLUMN IF NOT EXISTS creators_enriched int4 NULL DEFAULT 0",
    "ALTER TABLE scraping_jobs ADD COLUMN IF NOT EXISTS used_keywords jsonb NULL",
    "ALTER TABLE scraping_jobs ADD COLUMN IF NOT EXISTS keywords_dispatched int4 NULL DEFAULT 0",
    "ALTER TABLE scraping_jobs ADD COLUMN IF NOT EXISTS enrichment_status varchar NULL DEFAULT 'pending'",
    "ALTER TABLE scraping_jobs ADD COLUMN IF NOT EXISTS creators_found int4 NULL DEFAULT 0",
    "ALTER TABLE scraping_jobs ADD COLUMN IF NOT EXISTS expansion_round int4 NULL DEFAULT 1",

    # 5. Create indexes
    "CREATE INDEX IF NOT EXISTS idx_background_jobs_qstash_message_id ON background_jobs(qstash_message_id)",
    "CREATE INDEX IF NOT EXISTS idx_background_jobs_status_scheduled ON background_jobs(status, scheduled_at)",
    "CREATE INDEX IF NOT EXISTS creator_list_collaborators_list_idx ON creator_list_collaborators(list_id)",
    "CREATE INDEX IF NOT EXISTS creator_list_items_creator_idx ON creator_list_items(creator_id)",
    "CREATE INDEX IF NOT EXISTS creator_list_items_list_idx ON creator_list_items(list_id)",
    "CREATE INDEX IF NOT EXISTS creator_lists_owner_idx ON creator_lists(owner_id)",
    "CREATE INDEX IF NOT EXISTS creator_lists_privacy_idx ON creator_lists(privacy)",
    "CREATE INDEX IF NOT EXISTS idx_creator_profiles_platform_handle ON creator_profiles(platform, handle)",
    "CREATE INDEX IF NOT EXISTS idx_events_aggregate_type_time ON events(aggregate_id, event_type, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_scraping_jobs_qstash_message_id ON scraping_jobs(qstash_message_id)",
    "CREATE INDEX IF NOT EXISTS idx_scraping_jobs_campaign_status ON scraping_jobs(campaign_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_search_jobs_campaign_status ON search_jobs(campaign_id, status)",

    # 6. Fix nullability
    "ALTER TABLE user_usage ALTER COLUMN enrichments_current_month DROP NOT NULL",
]

def run_migrations():
    print("=" * 60)
    print("RUNNING MIGRATIONS ON PROD")
    print("=" * 60)

    conn = psycopg2.connect(PROD_DB)
    cursor = conn.cursor()

    success_count = 0
    error_count = 0

    for i, sql in enumerate(MIGRATIONS):
        sql_preview = sql.strip().replace('\n', ' ')[:80]
        print(f"\n[{i+1}/{len(MIGRATIONS)}] {sql_preview}...")

        try:
            cursor.execute(sql)
            conn.commit()
            print("  ✅ Success")
            success_count += 1
        except Exception as e:
            conn.rollback()
            error_msg = str(e).strip()
            if "already exists" in error_msg or "does not exist" in error_msg:
                print(f"  ⚠️  Skipped: {error_msg[:60]}")
                success_count += 1
            else:
                print(f"  ❌ Error: {error_msg}")
                error_count += 1

    cursor.close()
    conn.close()

    print("\n" + "=" * 60)
    print(f"MIGRATION COMPLETE: {success_count} succeeded, {error_count} failed")
    print("=" * 60)

if __name__ == "__main__":
    run_migrations()
