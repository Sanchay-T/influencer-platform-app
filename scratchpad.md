# Scratchpad - Implementation Notes

> **Purpose**: Dumping ground for detailed implementation thoughts, code snippets, and session progress.
> **Related**: See `task.md` for high-level task tracking.

---

## Session: 2025-12-03 - Webhook Idempotency Implementation

### Understanding the Problem

Webhooks are HTTP callbacks that external services (Clerk, Stripe) send to notify us of events. The challenge is that webhooks can be:

1. **Replayed**: Stripe/Clerk may retry if they don't get a 2xx response
2. **Duplicated**: Network issues can cause the same event to arrive twice
3. **Out of order**: Event A (created at T1) might arrive after Event B (created at T2)
4. **Partially processed**: Handler might fail mid-way through multiple DB writes

### Current Webhook Architecture

```
Clerk (user.created, user.updated, user.deleted)
    │
    └──► /api/webhooks/clerk/route.ts
              │
              ├── Verify Svix signature
              ├── Parse event type
              └── Handle event:
                    ├── user.created → createUser() [4 INSERTs in tx]
                    ├── user.updated → updateUserProfile()
                    └── user.deleted → db.delete()

Stripe (checkout.session.completed, subscription.*, invoice.*, etc)
    │
    ├──► /api/webhooks/stripe/route.ts (PRIMARY)
    │         │
    │         ├── Verify Stripe signature
    │         ├── Parse event type
    │         └── Handle events (subscription, checkout, invoice)
    │
    └──► /api/stripe/webhook/route.ts (SECONDARY - why does this exist?)
              │
              └── Similar handling but different implementation
```

### Idempotency Strategy

**Option 1: Event ID Deduplication Table**
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,  -- Stripe/Clerk event ID
  source VARCHAR(50) NOT NULL,             -- 'clerk' | 'stripe'
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'processing', -- 'processing' | 'completed' | 'failed'
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  error_message TEXT,
  metadata JSONB
);
```

**Flow:**
1. Webhook arrives with event_id
2. Check if event_id exists in webhook_events
3. If exists and completed → return 200 (already processed)
4. If exists and processing → return 200 (let first one finish)
5. If not exists → insert as 'processing', process, update to 'completed'

**Option 2: Timestamp-based Ordering**
```typescript
// In each handler
if (userProfile.lastWebhookTimestamp > event.created) {
  // This event is older than what we've already processed
  return; // Skip
}
```

**Decision: Use BOTH**
- Event ID deduplication prevents replay attacks
- Timestamp ordering prevents state corruption from out-of-order delivery

### Implementation Checklist

```
[ ] Schema Changes
    [ ] Add webhook_events table to schema.ts
    [ ] Add lastWebhookTimestamp to user tables
    [ ] Generate migration
    [ ] Run migration

[ ] Shared Idempotency Helper
    [ ] Create lib/webhooks/idempotency.ts
    [ ] checkAndMarkProcessing(eventId, source, type)
    [ ] markCompleted(eventId)
    [ ] markFailed(eventId, error)
    [ ] isEventStale(eventTimestamp, lastProcessed)

[ ] Clerk Webhook Updates
    [ ] Add idempotency check at entry
    [ ] Make user.created use ensureUserProfile (handle race)
    [ ] Add transaction wrapping
    [ ] Update lastWebhookTimestamp on success

[ ] Stripe Webhook Updates (Primary)
    [ ] Add idempotency check at entry
    [ ] Add ordering validation
    [ ] Wrap handlers in transactions
    [ ] Handle partial failures gracefully

[ ] Stripe Webhook Updates (Secondary)
    [ ] Determine if we need both endpoints
    [ ] If yes, apply same fixes
    [ ] If no, deprecate/remove

[ ] Testing
    [ ] Test duplicate event handling
    [ ] Test out-of-order events
    [ ] Test partial failure recovery
    [ ] Load test with webhook flood
```

### Code Snippets to Use

**Idempotency Helper Draft:**
```typescript
// lib/webhooks/idempotency.ts
import { db } from '@/lib/db';
import { webhookEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function checkIdempotency(
  eventId: string,
  source: 'clerk' | 'stripe',
  eventType: string
): Promise<{ shouldProcess: boolean; existing?: typeof webhookEvents.$inferSelect }> {
  // Check if already processed
  const existing = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.eventId, eventId)
  });

  if (existing) {
    if (existing.status === 'completed') {
      return { shouldProcess: false, existing };
    }
    // Already processing - let first one finish
    if (existing.status === 'processing') {
      return { shouldProcess: false, existing };
    }
  }

  // Mark as processing
  await db.insert(webhookEvents).values({
    eventId,
    source,
    eventType,
    status: 'processing'
  }).onConflictDoNothing();

  return { shouldProcess: true };
}

export async function markWebhookCompleted(eventId: string) {
  await db.update(webhookEvents)
    .set({ status: 'completed', processedAt: new Date() })
    .where(eq(webhookEvents.eventId, eventId));
}

export async function markWebhookFailed(eventId: string, error: string) {
  await db.update(webhookEvents)
    .set({ status: 'failed', errorMessage: error })
    .where(eq(webhookEvents.eventId, eventId));
}
```

### Questions to Resolve

1. **Do we need both Stripe webhook endpoints?**
   - `/api/webhooks/stripe/route.ts`
   - `/api/stripe/webhook/route.ts`
   - Need to check which one is configured in Stripe dashboard

2. **How long to keep webhook_events records?**
   - Stripe replays within 3 days
   - Could add cleanup job for records older than 7 days

3. **Should we use Redis instead of Postgres for idempotency?**
   - Postgres is fine for our scale
   - Redis would be faster but adds infrastructure complexity

---

## Progress Log

### 2025-12-03 (Session 2 - Continued)
- Resumed from context summary
- Verified memory files (task.md, scratchpad.md) are intact
- Completed Stripe webhook (primary) idempotency implementation
- Completed Stripe webhook (secondary) idempotency implementation
- Fixed migration path (was in drizzle/, moved to supabase/migrations/)
- Applied migration directly via script (Drizzle journal wasn't tracking it)
- Created and ran test script (`scripts/test-webhook-idempotency.ts`)
- All 5 tests pass:
  - ✅ First event processed
  - ✅ Duplicate event skipped (already_processing)
  - ✅ Event marked as completed
  - ✅ Completed event skipped (already_completed)
  - ✅ Failed event marked with error

### 2025-12-03 08:30 IST
- Created task.md and scratchpad.md for memory persistence
- About to clean up credential-exposed files
- Next: Implement webhook idempotency

---

## Random Notes

- Vercel serverless functions have 10s default timeout, 60s max on Pro
- Stripe webhook timeout is 30 seconds
- Clerk webhook timeout is similar
- PgBouncer transaction mode means we can't use prepared statements
- Always use `?pgbouncer=true` in connection string for Supabase pooler
