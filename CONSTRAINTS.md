# CONSTRAINTS.md — Hard Rules (Never Violate)

This file contains inviolable constraints that agents must follow. Breaking these rules causes data corruption, security vulnerabilities, or system failures.

---

## Database Access Constraints

### User Data: 5-Table Normalization

User data is split across 5 tables: `users`, `userSubscriptions`, `userBilling`, `userUsage`, `userSystemData`.

**NEVER DO THIS:**
```typescript
// ❌ WRONG: Direct table query
const user = await db.select().from(users).where(eq(users.userId, id));
// Missing subscription, billing, usage data!

// ❌ WRONG: Partial update
await db.update(userSubscriptions).set({ currentPlan: 'viral_surge' });
// Other tables may need updating too!
```

**ALWAYS DO THIS:**
```typescript
// ✅ CORRECT: Use the abstraction
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';

const user = await getUserProfile(userId);  // Joins all 5 tables
await updateUserProfile(userId, { currentPlan: 'viral_surge' });  // Updates appropriate tables
```

### Schema Changes Require Migrations

**NEVER** modify `lib/db/schema.ts` without running:
```bash
npm run db:generate   # Generate migration
npm run db:migrate    # Apply migration
```

Direct schema changes without migrations cause production drift.

---

## Authentication Constraints

### Every API Route Must Authenticate

**NEVER DO THIS:**
```typescript
// ❌ WRONG: No auth check
export async function POST(req: Request) {
  const body = await req.json();
  await db.insert(campaigns).values(body);  // Anyone can call this!
}
```

**ALWAYS DO THIS:**
```typescript
// ✅ CORRECT: Auth first
export async function POST(req: Request) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Now safe to proceed
}
```

### Use Our Auth Wrapper, Not Clerk Directly

**NEVER DO THIS:**
```typescript
// ❌ WRONG: Direct Clerk usage
import { auth } from '@clerk/nextjs/server';
const { userId } = auth();
```

**ALWAYS DO THIS:**
```typescript
// ✅ CORRECT: Use our wrapper (supports test bypass)
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
const { userId } = await getAuthOrTest();
```

### Webhook Exception

Webhooks verify signatures instead of user auth:
- Stripe: Verify `stripe-signature` header
- Clerk: Verify Svix signature
- QStash: Verify `Upstash-Signature` header

---

## Status Value Constraints

### Use Exact Status Strings

Status values are case-sensitive strings. Using wrong values corrupts data.

**Job Status (scrapingJobs.status):**
```typescript
// ✅ ONLY these values:
'pending' | 'processing' | 'completed' | 'error' | 'timeout'

// ❌ NOT these (common mistakes):
'done'      // Wrong! Use 'completed'
'failed'    // Wrong! Use 'error'
'running'   // Wrong! Use 'processing'
'draft'     // Wrong! That's for campaigns, not jobs
```

**Trial Status (userSubscriptions.trialStatus):**
```typescript
// ✅ ONLY these values:
'pending' | 'active' | 'converted' | 'expired'

// ❌ NOT these:
'cancelled'  // Wrong! Use 'expired'
'completed'  // Wrong! Use 'converted'
```

**Plan Keys (userSubscriptions.currentPlan):**
```typescript
// ✅ ONLY these values:
'free' | 'glow_up' | 'viral_surge' | 'fame_flex'

// ❌ NOT these:
'Free'       // Wrong! Lowercase only
'glowUp'     // Wrong! Use underscores
'basic'      // Wrong! Not a valid plan
```

**Onboarding Steps (users.onboardingStep):**
```typescript
// ✅ ONLY these values:
'pending' | 'step_1' | 'step_2' | 'completed'

// ❌ NOT these:
'step_3'     // Wrong! Step 3 doesn't exist
'done'       // Wrong! Use 'completed'
```

---

## Logging Constraints

### No Console.log in Production Code

**NEVER DO THIS:**
```typescript
// ❌ WRONG: Unstructured, no context, not filterable
console.log('User created:', userId);
console.error('Failed:', error);
```

**ALWAYS DO THIS:**
```typescript
// ✅ CORRECT: Structured logging
import { logger, LogCategory } from '@/lib/logging';

logger.info('User created', { userId }, LogCategory.API);
logger.error('Operation failed', error, { userId, context }, LogCategory.DATABASE);
```

Or use `BillingLogger` for billing-related events:
```typescript
import BillingLogger from '@/lib/loggers/billing-logger';

await BillingLogger.logAccess('GRANTED', 'User accessed resource', userId, { resource });
```

---

## Webhook Constraints

### Idempotency is Mandatory

Webhooks can fire multiple times. Processing duplicates causes:
- Double charges
- Incorrect usage counts
- Data corruption

**ALWAYS CHECK:**
```typescript
// Check for recent duplicate
const user = await getUserProfile(userId);
const isRecent = user.lastWebhookTimestamp &&
  (Date.now() - new Date(user.lastWebhookTimestamp).getTime() < 5 * 60 * 1000);
const isDuplicate = isRecent &&
  user.lastWebhookEvent === eventType;

if (isDuplicate) {
  logger.info('Duplicate webhook skipped', { eventType });
  return NextResponse.json({ received: true });
}
```

**ALWAYS UPDATE:**
```typescript
// After processing, record the event
await updateUserProfile(userId, {
  lastWebhookEvent: eventType,
  lastWebhookTimestamp: new Date()
});
```

### Always Return 200

Even for unhandled events, return 200 to prevent infinite retries:
```typescript
switch (event.type) {
  case 'checkout.session.completed':
    await handleCheckout(event);
    break;
  default:
    // Log but don't fail
    logger.info('Unhandled webhook event', { type: event.type });
}

// Always return 200
return NextResponse.json({ received: true });
```

---

## Plan Validation Constraints

### Validate Before Resource Creation

**NEVER** create resources without checking plan limits:

```typescript
// ❌ WRONG: Create without checking
const campaign = await db.insert(campaigns).values({ userId, name });

// ✅ CORRECT: Validate first
const validation = await PlanValidator.validateCampaignCreation(userId, requestId);
if (!validation.allowed) {
  return NextResponse.json({
    error: validation.reason,
    upgradeRequired: true
  }, { status: 403 });
}
const campaign = await db.insert(campaigns).values({ userId, name });
```

### Track Usage After Success

```typescript
// After successful creation, increment counters
await PlanEnforcement.incrementUsage(userId, 'campaigns', 1);
```

---

## Security Constraints

### Never Expose Internal Errors

**NEVER DO THIS:**
```typescript
// ❌ WRONG: Exposes stack trace
catch (error) {
  return NextResponse.json({ error: error.stack }, { status: 500 });
}
```

**ALWAYS DO THIS:**
```typescript
// ✅ CORRECT: Log internally, return safe message
catch (error) {
  logger.error('Operation failed', error, { userId });
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### Verify Resource Ownership

Before returning or modifying data, verify the user owns it:
```typescript
const campaign = await db.query.campaigns.findFirst({
  where: and(
    eq(campaigns.id, campaignId),
    eq(campaigns.userId, userId)  // 👈 Ownership check
  )
});

if (!campaign) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

---

## Environment Constraints

### Never Hardcode Secrets

**NEVER DO THIS:**
```typescript
// ❌ WRONG: Secrets in code
const stripe = new Stripe('sk_live_xxx');
```

**ALWAYS DO THIS:**
```typescript
// ✅ CORRECT: From environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

### Dev Features Off in Production

Test bypass features are disabled in production (`NODE_ENV === 'production'`).

**NEVER** add code that bypasses this check.

---

## Summary: Before You Code

Ask yourself:
1. Am I querying user data directly? → Use `getUserProfile()`
2. Am I skipping auth? → Add `getAuthOrTest()` check
3. Am I using a status string? → Verify it's in the allowed list
4. Am I using console.log? → Switch to `logger.*`
5. Am I handling a webhook? → Add idempotency check
6. Am I creating a resource? → Add plan validation
7. Am I changing schema? → Run migrations
