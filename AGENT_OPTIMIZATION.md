# Agent Optimization Guide — Making AI Agents Code Better in This Repo

## Executive Summary

This guide provides a comprehensive system for optimizing AI agent performance in the Gemz codebase. Based on analysis of 357 TypeScript files, 96 API routes, and existing `.claude/` infrastructure, this document outlines **7 pillars** for agent success.

---

## What Already Exists (Leverage This)

Your codebase already has strong foundations:

```
.claude/
├── commands/           → 24 slash commands for common operations
│   ├── user/          → /user:inspect, /user:reset, /user:fix-billing
│   ├── db/            → /db:analyze, /db:seed-plans
│   ├── test/          → /test:instagram, /test:subscription
│   └── dev/           → /dev:ngrok, /dev:validate
├── skills/            → 8 domain expertise files
│   ├── api-route-conventions/    → API patterns (598 lines!)
│   ├── billing-system-expert/    → Stripe, plans, trials
│   ├── database-schema-expert/   → Drizzle, 5-table user model
│   └── qstash-job-processing/    → Background job patterns
├── agents/            → 10 specialized sub-agents
│   ├── api-endpoint-creator.json → Creates new API routes
│   ├── billing-system-auditor.json
│   └── user-state-debugger.json
└── CLAUDE.md          → Extended project memory
```

**Recommendation:** Train agents to invoke these FIRST before writing code.

---

## The 7 Pillars of Agent Optimization

### Pillar 1: Constraint Files (Guardrails)

Create files that enforce rules agents cannot bypass.

**Create: `CONSTRAINTS.md`**
```markdown
# Hard Constraints (NEVER VIOLATE)

## Database Access
- NEVER query `users`, `userSubscriptions`, `userBilling`, `userUsage`, `userSystemData` directly
- ALWAYS use `getUserProfile()` and `updateUserProfile()` from `lib/db/queries/user-queries.ts`
- ALWAYS run `npm run db:generate && npm run db:migrate` after schema changes

## Authentication
- EVERY API route MUST call `getAuthOrTest()` as the FIRST operation
- NEVER use `auth()` from Clerk directly—use our wrapper
- Webhook routes are the ONLY exception (they verify signatures instead)

## Status Values (Type-Safe)
- Job status: ONLY use `'pending' | 'processing' | 'completed' | 'error' | 'timeout'`
- Trial status: ONLY use `'pending' | 'active' | 'converted' | 'expired'`
- Plan keys: ONLY use `'free' | 'glow_up' | 'viral_surge' | 'fame_flex'`

## Logging
- NEVER use `console.log` in production code
- ALWAYS use `logger.*` from `@/lib/logging` or `BillingLogger`

## Webhooks
- EVERY webhook handler MUST check idempotency using `lastWebhookEvent` + `lastWebhookTimestamp`
- ALWAYS return 200 even for unhandled events (prevents retries)
```

**Create: `lib/types/statuses.ts`** (Type-safe status constants)
```typescript
// Job statuses
export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
  TIMEOUT: 'timeout',
} as const;
export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

// Trial statuses
export const TRIAL_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CONVERTED: 'converted',
  EXPIRED: 'expired',
} as const;
export type TrialStatus = typeof TRIAL_STATUS[keyof typeof TRIAL_STATUS];

// Plan keys
export const PLAN_KEY = {
  FREE: 'free',
  GLOW_UP: 'glow_up',
  VIRAL_SURGE: 'viral_surge',
  FAME_FLEX: 'fame_flex',
} as const;
export type PlanKey = typeof PLAN_KEY[keyof typeof PLAN_KEY];

// Onboarding steps
export const ONBOARDING_STEP = {
  PENDING: 'pending',
  STEP_1: 'step_1',
  STEP_2: 'step_2',
  COMPLETED: 'completed',
} as const;
export type OnboardingStep = typeof ONBOARDING_STEP[keyof typeof ONBOARDING_STEP];
```

---

### Pillar 2: Decision Trees (Remove Ambiguity)

**Create: `DECISIONS.md`**

```markdown
# Decision Trees for Common Scenarios

## When to Use PlanValidator vs BillingService

```
Need to CHECK if user can do something?
├── Check campaign creation limit → PlanValidator.validateCampaignCreation()
├── Check creator search limit → PlanValidator.validateCreatorLimit()
├── Check feature access → PlanValidator.hasFeature()
└── Get full plan config → PlanValidator.getActiveUserPlan()

Need to SYNC with Stripe or get billing info?
├── Get billing state with cache (30s) → BillingService.getBillingStateWithCache()
├── Get fresh billing state → BillingService.getBillingState()
├── Sync after webhook → BillingService.reconcileWithStripe()
└── Create checkout session → BillingService.createCheckoutSession()

Need to TRACK usage after an action?
└── Increment counters → PlanEnforcement.incrementUsage()
```

## When to Use Cached vs Fresh Data

```
Display on dashboard/UI?
└── Use cached: BillingService.getBillingStateWithCache()

Before charging money or limiting user?
└── Use fresh: BillingService.getBillingState()

After Stripe webhook?
└── Use reconcile: BillingService.reconcileWithStripe()
```

## Logging Level Selection

```
Debug info (filtered in production)?
└── logger.debug()

Normal operation events?
└── logger.info()

Something unusual but handled?
└── logger.warn()

Operation failed (sends to Sentry)?
└── logger.error()

System-critical failure?
└── logger.critical()
```

## Search Provider Selection

```
Instagram keyword search?
├── Use v2 pipeline (recommended) → searchParams.runner = 'instagram_us_reels'
└── Use v1 legacy (Apify) → platform = 'instagram' (no runner param)

TikTok search?
└── runTikTokKeywordProvider()

YouTube keyword?
└── runYouTubeKeywordProvider()

Similar creator search?
├── Instagram → runInstagramSimilarProvider()
└── YouTube → runYouTubeSimilarProvider()
```
```

---

### Pillar 3: Templates & Scaffolding

**Create: `.claude/templates/`**

**`.claude/templates/api-route.ts.template`**
```typescript
/**
 * API Route: {{ENDPOINT_PATH}}
 * Method: {{METHOD}}
 * Description: {{DESCRIPTION}}
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { logger, LogCategory } from '@/lib/logging';
import { db } from '@/lib/db';
import { PlanValidator } from '@/lib/services/plan-validator';
import BillingLogger from '@/lib/loggers/billing-logger';

export const maxDuration = 10;

export async function {{METHOD}}(req: NextRequest) {
  const requestId = BillingLogger.generateRequestId();

  try {
    // 1. Authentication
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Plan Validation (if needed)
    // const validation = await PlanValidator.validate{{RESOURCE}}(userId, requestId);
    // if (!validation.allowed) {
    //   return NextResponse.json({
    //     error: validation.reason,
    //     upgradeRequired: true
    //   }, { status: 403 });
    // }

    // 3. Parse Input
    {{#if IS_POST}}
    const body = await req.json();
    {{/if}}
    {{#if IS_GET}}
    const searchParams = req.nextUrl.searchParams;
    {{/if}}

    // 4. Validate Input
    // if (!body.requiredField) {
    //   return NextResponse.json({ error: 'Missing required field' }, { status: 400 });
    // }

    // 5. Business Logic
    // TODO: Implement

    // 6. Log Success
    logger.info('{{OPERATION}} completed', { userId, requestId }, LogCategory.API);

    // 7. Return Response
    return NextResponse.json({ success: true, data: {} });

  } catch (error) {
    logger.error('{{OPERATION}} failed', error as Error, { requestId }, LogCategory.API);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**`.claude/templates/webhook-handler.ts.template`**
```typescript
/**
 * Webhook: {{WEBHOOK_NAME}}
 * Provider: {{PROVIDER}}
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger, LogCategory } from '@/lib/logging';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';

export async function POST(req: NextRequest) {
  try {
    // 1. Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('{{SIGNATURE_HEADER}}');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // 2. Verify signature
    // const isValid = verify{{PROVIDER}}Signature(rawBody, signature);
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    // 3. Parse event
    const event = JSON.parse(rawBody);

    // 4. Idempotency check (CRITICAL!)
    // const user = await getUserProfile(userId);
    // const isRecent = user.lastWebhookTimestamp &&
    //   (Date.now() - new Date(user.lastWebhookTimestamp).getTime() < 5 * 60 * 1000);
    // const isDuplicate = isRecent &&
    //   user.lastWebhookEvent === event.type;
    // if (isDuplicate) {
    //   logger.info('Duplicate webhook skipped', { eventType: event.type });
    //   return NextResponse.json({ received: true });
    // }

    // 5. Handle event
    switch (event.type) {
      case '{{EVENT_TYPE}}':
        // await handle{{EVENT_NAME}}(event.data);
        break;
      default:
        logger.info('Unhandled webhook event', { type: event.type }, LogCategory.API);
    }

    // 6. Update last webhook event
    // await updateUserProfile(userId, {
    //   lastWebhookEvent: event.type,
    //   lastWebhookTimestamp: new Date()
    // });

    // 7. Always return 200
    return NextResponse.json({ received: true });

  } catch (error) {
    logger.error('Webhook handler failed', error as Error, {}, LogCategory.API);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
```

---

### Pillar 4: Validation & Type Safety

**Create: `lib/validation/schemas.ts`** (Zod schemas)
```typescript
import { z } from 'zod';
import { PLAN_KEY, JOB_STATUS, TRIAL_STATUS } from '@/lib/types/statuses';

// Campaign creation
export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['instagram', 'tiktok', 'youtube']),
  keywords: z.array(z.string()).min(1).max(10).optional(),
  targetUsername: z.string().optional(),
  targetResults: z.number().int().min(10).max(10000).default(1000),
});

// Onboarding step 1
export const OnboardingStep1Schema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
});

// Onboarding step 2
export const OnboardingStep2Schema = z.object({
  businessName: z.string().min(1).max(100),
  brandDescription: z.string().max(500).optional(),
  industry: z.string().optional(),
});

// Plan selection
export const SelectPlanSchema = z.object({
  planKey: z.enum([PLAN_KEY.GLOW_UP, PLAN_KEY.VIRAL_SURGE, PLAN_KEY.FAME_FLEX]),
});

// Creator list
export const CreateListSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['custom', 'campaign', 'favorites', 'industry', 'contacted']).default('custom'),
});

// Export helper
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
```

**Create: `lib/validation/middleware.ts`**
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function withValidation<T>(
  req: Request,
  schema: z.ZodSchema<T>,
  handler: (data: T) => Promise<Response>
): Promise<Response> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      }, { status: 400 });
    }

    return handler(result.data);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
```

---

### Pillar 5: Testing Infrastructure

**Create: `lib/test-utils/api-test-helper.ts`**
```typescript
import { NextRequest } from 'next/server';

interface TestRequestOptions {
  method?: string;
  userId?: string;
  email?: string;
  body?: Record<string, unknown>;
  searchParams?: Record<string, string>;
}

export function createTestRequest(
  url: string,
  options: TestRequestOptions = {}
): NextRequest {
  const { method = 'GET', userId, email, body, searchParams } = options;

  const fullUrl = new URL(url, 'http://localhost:3000');
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value);
    });
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (userId) {
    headers.set('x-test-user-id', userId);
  }
  if (email) {
    headers.set('x-test-email', email);
  }

  return new NextRequest(fullUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function expectSuccess(response: Response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  expect(data.error).toBeUndefined();
  return data;
}

export async function expectError(response: Response, expectedStatus: number) {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  expect(data.error).toBeDefined();
  return data;
}

export async function expectAuthFailure(response: Response) {
  return expectError(response, 401);
}

export async function expectPlanLimitFailure(response: Response) {
  const data = await expectError(response, 403);
  expect(data.upgradeRequired).toBe(true);
  return data;
}
```

**Create: `.claude/commands/test/api-route.md`**
```markdown
---
name: test:api
description: Test an API route with common scenarios
---

# Test API Route

Testing API route: $ARGUMENTS

## Test Execution

```bash
# 1. Test unauthorized access (should return 401)
curl -s $ARGUMENTS | jq

# 2. Test with auth bypass (should succeed)
curl -s $ARGUMENTS \
  -H "x-test-user-id: user_test123" \
  -H "x-test-email: test@example.com" | jq

# 3. Check response format
```

## Expected Results

- ❌ No auth → 401 Unauthorized
- ✅ With auth → 200 OK (or appropriate success code)
- Proper JSON structure
- Logging in server output
```

---

### Pillar 6: Error Code System

**Create: `lib/errors/codes.ts`**
```typescript
export const ERROR_CODES = {
  // Authentication
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',

  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',

  // Plan limits
  PLAN_LIMIT_CAMPAIGNS: 'PLAN_LIMIT_CAMPAIGNS',
  PLAN_LIMIT_CREATORS: 'PLAN_LIMIT_CREATORS',
  PLAN_LIMIT_ENRICHMENTS: 'PLAN_LIMIT_ENRICHMENTS',
  PLAN_FEATURE_UNAVAILABLE: 'PLAN_FEATURE_UNAVAILABLE',
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',

  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Jobs
  JOB_TIMEOUT: 'JOB_TIMEOUT',
  JOB_FAILED: 'JOB_FAILED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',

  // External services
  STRIPE_ERROR: 'STRIPE_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
) {
  return {
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}
```

---

### Pillar 7: Pre-Commit Hooks & Feedback Loops

**Create: `.claude/hooks/pre-commit-check.md`**
```markdown
---
name: pre-commit-check
description: Validation to run before committing
---

# Pre-Commit Validation

Run these checks before committing:

## 1. TypeScript Compilation
```bash
npx tsc --noEmit
```

## 2. Linting
```bash
npm run lint
```

## 3. Schema Validation (if schema.ts changed)
```bash
npm run db:generate --dry-run
```

## 4. Test Critical Paths
```bash
npm run test:quick
```

## 5. Check for Console Logs
```bash
grep -r "console.log" --include="*.ts" --include="*.tsx" app/ lib/ | grep -v "node_modules" | grep -v ".next"
```

## Failure Handling

If any check fails:
1. Fix the issue
2. Re-run the failing check
3. Only commit when all checks pass
```

---

## Workflow Recommendations

### For New API Endpoint

```
1. Agent reads CLAUDE.md (root) → understands structure
2. Agent invokes skill: api-route-conventions → gets template
3. Agent reads DECISIONS.md → knows which services to use
4. Agent reads CONSTRAINTS.md → knows hard rules
5. Agent creates route using template
6. Agent runs /test:api → validates
7. Agent updates CLAUDE.md in that folder if needed
```

### For Database Changes

```
1. Agent reads lib/db/CLAUDE.md → understands schema
2. Agent invokes skill: database-schema-expert → gets patterns
3. Agent reads CONSTRAINTS.md → knows migration rules
4. Agent modifies schema.ts
5. Agent runs: npm run db:generate
6. Agent runs: npm run db:migrate
7. Agent updates lib/db/CLAUDE.md if significant
```

### For Billing/Plan Changes

```
1. Agent reads DECISIONS.md → PlanValidator vs BillingService
2. Agent invokes skill: billing-system-expert
3. Agent reads CONSTRAINTS.md → idempotency rules
4. Agent implements change
5. Agent runs /test:subscription
6. Agent verifies webhook handling
```

---

## Quick Reference Card

### Must-Know Functions

| Task | Function | Location |
|------|----------|----------|
| Get auth | `getAuthOrTest()` | `lib/auth/get-auth-or-test.ts` |
| Get user data | `getUserProfile(userId)` | `lib/db/queries/user-queries.ts` |
| Update user | `updateUserProfile(userId, changes)` | `lib/db/queries/user-queries.ts` |
| Check plan limit | `PlanValidator.validateCampaignCreation()` | `lib/services/plan-validator.ts` |
| Get billing state | `BillingService.getBillingState()` | `lib/services/billing-service.ts` |
| Run search job | `runSearchJob(jobId)` | `lib/search-engine/runner.ts` |
| Log event | `logger.info(msg, ctx, LogCategory.*)` | `lib/logging/index.ts` |

### Must-Know Commands

| Command | Description |
|---------|-------------|
| `/user:inspect email` | Debug user state |
| `/user:reset email` | Reset onboarding |
| `/test:subscription` | Test billing E2E |
| `/test:instagram keyword` | Test search |
| `/db:analyze` | Check DB performance |
| `/dev:ngrok` | Start with webhook tunnel |

### Status Values (Memorize These)

```
Job: pending → processing → completed | error | timeout
Trial: pending → active → converted | expired
Plan: free | glow_up | viral_surge | fame_flex
Onboarding: pending → step_1 → step_2 → completed
```

---

## Implementation Priority

1. **High Impact, Low Effort**
   - Create `CONSTRAINTS.md` (prevents major mistakes)
   - Create `DECISIONS.md` (removes ambiguity)
   - Create `lib/types/statuses.ts` (type safety)

2. **High Impact, Medium Effort**
   - Create validation schemas (`lib/validation/schemas.ts`)
   - Create test helpers (`lib/test-utils/`)
   - Create error codes (`lib/errors/codes.ts`)

3. **Medium Impact, Low Effort**
   - Add templates to `.claude/templates/`
   - Update existing CLAUDE.md files with "To grep:" hints
   - Add idempotency middleware for webhooks

4. **Ongoing**
   - Update docs when patterns change
   - Add new slash commands for common operations
   - Refine skills based on agent mistakes
