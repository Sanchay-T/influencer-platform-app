-- Clean up stalled/pending jobs for testing
UPDATE scraping_jobs 
SET status = 'cancelled', 
    error = 'Cancelled for testing cleanup',
    completed_at = NOW(),
    updated_at = NOW()
WHERE status IN ('pending', 'processing') 
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Check remaining active jobs
SELECT id, status, platform, created_at, updated_at 
FROM scraping_jobs 
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC;