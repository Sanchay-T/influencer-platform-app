# Scalability Test Suite

Tests to verify scalability fixes before and after implementation.

## Test Categories

| Test | Purpose | Run Command |
|------|---------|-------------|
| `verify-indexes.ts` | Check database indexes exist and are used | `npx tsx testing/scalability/verify-indexes.ts` |
| `verify-webhooks.ts` | Check webhook timeout and stale detection | `npx tsx testing/scalability/verify-webhooks.ts` |
| `verify-qstash.ts` | Check QStash idempotency | `npx tsx testing/scalability/verify-qstash.ts` |
| `verify-api-routes.ts` | Check maxDuration and concurrency limits | `npx tsx testing/scalability/verify-api-routes.ts` |
| `run-all.ts` | Run complete test suite | `npx tsx testing/scalability/run-all.ts` |

## Running Tests

### Pre-Implementation (Baseline)
```bash
# Run before implementing fixes to establish baseline
npx tsx testing/scalability/run-all.ts --baseline
```

### Post-Implementation (Verification)
```bash
# Run after implementing fixes to verify improvements
npx tsx testing/scalability/run-all.ts --verify
```

## Expected Results

### Database Indexes
- BEFORE: Seq Scan (full table scan)
- AFTER: Index Scan (fast lookup)

### Webhook Safety
- BEFORE: No maxDuration, isEventStale not called
- AFTER: maxDuration=60, stale check implemented

### QStash Idempotency
- BEFORE: Multiple continuations scheduled
- AFTER: Single continuation per job

### API Route Safety
- BEFORE: No maxDuration, unlimited parallelism
- AFTER: maxDuration set, concurrency limited
