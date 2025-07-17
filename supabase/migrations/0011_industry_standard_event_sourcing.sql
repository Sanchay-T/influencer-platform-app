-- Migration: Industry Standard Event Sourcing and Background Jobs
-- Created: 2025-01-17
-- Purpose: Add event sourcing and background job processing tables for proper industry-standard architecture

-- Event Sourcing table for tracking all state changes (Industry Standard)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id TEXT NOT NULL, -- User ID, Job ID, etc.
    aggregate_type VARCHAR(50) NOT NULL, -- 'user', 'subscription', 'onboarding'
    event_type VARCHAR(100) NOT NULL, -- 'subscription_created', 'onboarding_completed'
    event_version INTEGER NOT NULL DEFAULT 1,
    event_data JSONB NOT NULL, -- Full event payload
    metadata JSONB, -- Request ID, source, user agent, etc.
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE, -- When background job processed this event
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER NOT NULL DEFAULT 0,
    error TEXT, -- Error message if processing failed
    idempotency_key TEXT NOT NULL UNIQUE, -- Prevent duplicate processing
    source_system VARCHAR(50) NOT NULL, -- 'stripe_webhook', 'admin_action', 'user_action'
    correlation_id TEXT, -- Track related events
    causation_id TEXT -- What caused this event
);

-- Background Jobs table for QStash job tracking (Industry Standard)
CREATE TABLE IF NOT EXISTS background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL, -- 'complete_onboarding', 'send_trial_email'
    payload JSONB NOT NULL, -- Job data
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    qstash_message_id TEXT, -- QStash message ID for tracking
    priority INTEGER NOT NULL DEFAULT 100, -- Lower = higher priority
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_count INTEGER NOT NULL DEFAULT 0,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    result JSONB, -- Job execution result
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance (Industry Standard)

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_type ON events(aggregate_type);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_processing_status ON events(processing_status);
CREATE INDEX IF NOT EXISTS idx_events_source_system ON events(source_system);
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_aggregate_type_timestamp ON events(aggregate_id, aggregate_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_processing_pending ON events(processing_status, timestamp) WHERE processing_status = 'pending';

-- Background Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_job_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_scheduled_for ON background_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_background_jobs_priority ON background_jobs(priority, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_background_jobs_qstash_message_id ON background_jobs(qstash_message_id);

-- Composite indexes for job processing
CREATE INDEX IF NOT EXISTS idx_background_jobs_pending ON background_jobs(status, priority, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_background_jobs_processing ON background_jobs(status, started_at) WHERE status = 'processing';

-- Add comments for documentation
COMMENT ON TABLE events IS 'Event sourcing table tracking all state changes in the system following industry standards';
COMMENT ON TABLE background_jobs IS 'Background job queue integrated with QStash for async processing';

COMMENT ON COLUMN events.aggregate_id IS 'The ID of the entity this event relates to (user ID, subscription ID, etc.)';
COMMENT ON COLUMN events.aggregate_type IS 'The type of entity (user, subscription, onboarding, etc.)';
COMMENT ON COLUMN events.event_type IS 'The specific event that occurred (subscription_created, etc.)';
COMMENT ON COLUMN events.idempotency_key IS 'Unique key to prevent duplicate event processing';
COMMENT ON COLUMN events.correlation_id IS 'Links related events together in a business process';
COMMENT ON COLUMN events.causation_id IS 'References the event that caused this event';

COMMENT ON COLUMN background_jobs.job_type IS 'The type of background job to process';
COMMENT ON COLUMN background_jobs.priority IS 'Job priority (lower number = higher priority)';
COMMENT ON COLUMN background_jobs.qstash_message_id IS 'QStash message ID for tracking external queue status';

-- Add RLS (Row Level Security) policies if needed
-- Note: Adjust these based on your security requirements

-- Events table RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own events
CREATE POLICY "Users can read their own events" ON events
    FOR SELECT USING (
        aggregate_type = 'user' AND aggregate_id = auth.uid()::text
        OR 
        aggregate_type IN ('subscription', 'onboarding', 'payment', 'trial') 
        AND aggregate_id IN (
            SELECT user_id FROM user_profiles WHERE user_id = auth.uid()::text
        )
    );

-- Background Jobs table RLS
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Allow system to manage background jobs (adjust based on your auth system)
CREATE POLICY "System can manage background jobs" ON background_jobs
    FOR ALL USING (true); -- Adjust this policy based on your security requirements

-- Grant permissions to service role (adjust based on your setup)
GRANT ALL ON events TO postgres;
GRANT ALL ON background_jobs TO postgres;
GRANT ALL ON events TO service_role;
GRANT ALL ON background_jobs TO service_role;

-- Insert initial system configuration for job processing
INSERT INTO system_configurations (category, key, value, value_type, description, is_hot_reloadable) 
VALUES 
    ('job_processing', 'max_concurrent_jobs', '10', 'number', 'Maximum number of background jobs to process concurrently', 'true'),
    ('job_processing', 'default_retry_delay', '30000', 'duration', 'Default delay between job retries in milliseconds', 'true'),
    ('job_processing', 'job_timeout', '300000', 'duration', 'Default job timeout in milliseconds (5 minutes)', 'true'),
    ('event_sourcing', 'event_retention_days', '365', 'number', 'Number of days to retain events for audit', 'true'),
    ('event_sourcing', 'enable_event_replay', 'true', 'boolean', 'Enable event replay functionality', 'true')
ON CONFLICT (category, key) DO NOTHING;

-- Create audit log for this migration
INSERT INTO events (
    aggregate_id, 
    aggregate_type, 
    event_type, 
    event_data, 
    source_system, 
    idempotency_key
) VALUES (
    'system', 
    'user', 
    'admin_action',
    '{"action": "database_migration", "migration": "0011_industry_standard_event_sourcing", "description": "Added event sourcing and background jobs tables"}'::jsonb,
    'system_automation',
    'migration_0011_' || extract(epoch from now())::text
);

-- Verify tables were created successfully
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') THEN
        RAISE EXCEPTION 'Events table was not created successfully';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'background_jobs') THEN
        RAISE EXCEPTION 'Background jobs table was not created successfully';
    END IF;
    
    RAISE NOTICE 'Industry standard event sourcing migration completed successfully';
END $$;