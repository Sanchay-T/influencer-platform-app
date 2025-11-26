# lib/CLAUDE.md — Core Business Logic

## What This Directory Contains

The `lib/` directory is the heart of the application. It contains all business logic, database access, services, authentication, search engines, and utilities. If you need to understand how something works under the hood, it lives here.

This is NOT frontend code. This is backend infrastructure that API routes and server components consume.

---

## Directory Structure & Navigation Chain

```
lib/
├── auth/                    → Authentication & test bypass (see lib/auth/CLAUDE.md)
├── db/                      → Database schema & queries (see lib/db/CLAUDE.md)
│   ├── schema.ts            → Drizzle schema (SOURCE OF TRUTH)
│   ├── index.ts             → DB connection instance
│   └── queries/             → Query functions by domain
├── services/                → Business logic services (see lib/services/CLAUDE.md)
│   ├── plan-validator.ts    → Plan limit enforcement
│   ├── billing-service.ts   → Stripe integration
│   └── feature-gates.ts     → Feature flags
├── search-engine/           → Search job processing (see lib/search-engine/CLAUDE.md)
│   ├── runner.ts            → Provider dispatch hub
│   ├── job-service.ts       → Job lifecycle management
│   └── providers/           → Platform-specific implementations
├── instagram-us-reels/      → Instagram v2 pipeline (6-step)
│   ├── steps/               → Individual pipeline steps
│   └── clients/             → External API clients
├── logging/                 → Structured logging system
│   ├── logger.ts            → Core logger
│   └── index.ts             → Pre-configured loggers
├── email/                   → Email service & templates
├── stripe/                  → Stripe SDK wrappers
├── queue/                   → QStash job queue
├── config/                  → System configuration
├── hooks/                   → React hooks (client-side)
└── utils/                   → General utilities
```

---

## Critical Subdirectories

### Authentication (`lib/auth/`)
The auth system supports both Clerk (production) and test header bypass (development).

**Key file:** `get-auth-or-test.ts` — Function `getAuthOrTest()` is called by every API route.

See `lib/auth/CLAUDE.md` for details.

### Database (`lib/db/`)
Uses Drizzle ORM with PostgreSQL (Supabase). Users are normalized across 5 tables.

**Key files:**
- `schema.ts` — All table definitions (never modify without migration)
- `queries/user-queries.ts` — `getUserProfile()`, `updateUserProfile()`

See `lib/db/CLAUDE.md` for schema details and query patterns.

### Services (`lib/services/`)
Business logic layer. Services are static classes with methods that encapsulate domain logic.

**Key files:**
- `plan-validator.ts` — Class `PlanValidator` with `validateCampaignCreation()`, `validateCreatorLimit()`
- `billing-service.ts` — Stripe operations, trial management
- `plan-enforcement.ts` — Runtime limit enforcement

See `lib/services/CLAUDE.md` for service documentation.

### Search Engine (`lib/search-engine/`)
Handles all search job processing and provider dispatch.

**Key files:**
- `runner.ts` — Function `runSearchJob(jobId)` routes to correct provider
- `job-service.ts` — Class `SearchJobService` manages job state
- `providers/*.ts` — Platform-specific search implementations

See `lib/search-engine/CLAUDE.md` for provider details.

---

## Logging System (`lib/logging/`)

**Never use `console.log`** in this codebase. Use the structured logging system.

**Core file:** `logger.ts`
```typescript
import { logger, LogCategory } from '@/lib/logging';

logger.debug('Debug message', { data }, LogCategory.SYSTEM);
logger.info('Info message', { userId }, LogCategory.API);
logger.warn('Warning', { issue }, LogCategory.PERFORMANCE);
logger.error('Error', error, { context }, LogCategory.DATABASE);
```

**Pre-configured loggers** (from `index.ts`):
- `apiLogger` — API route logging
- `databaseLogger` — DB queries
- `authLogger` — Authentication events
- `paymentLogger` — Billing events
- `scrapingLogger` — Search jobs
- `campaignLogger` — Campaign events

To grep: `logger.info`, `logger.error`, `LogCategory`, `BillingLogger`

---

## Email System (`lib/email/`)

**Key file:** `email-service.ts`

Uses Resend for email delivery. Functions:
- `sendEmail(to, template, data)` — Send single email
- `scheduleTrialEmails(userId)` — Schedule day 2, day 5 reminders

**Trial email triggers** (`trial-email-triggers.ts`):
- `sendDay2Email()` — 2 days after trial start
- `sendDay5Email()` — 5 days after trial start
- `sendAbandonmentEmail()` — Post-trial if not converted

To grep: `sendEmail`, `scheduleTrialEmails`, `sendDay2Email`

---

## Queue System (`lib/queue/`)

**Key file:** `qstash.ts`

Upstash QStash wrapper for background jobs.

```typescript
import { qstash } from '@/lib/queue/qstash';

await qstash.publishJSON({
  url: 'https://yourapp.com/api/qstash/process-search',
  body: { jobId },
  retries: 3,
  delay: '5s'
});
```

To grep: `qstash.publishJSON`, `Upstash`, `QSTASH_TOKEN`

---

## Configuration (`lib/config/`)

**Key files:**
- `system-config.ts` — Runtime configuration (API limits, timeouts, delays)
- `environment-validator.ts` — Validates required env vars at startup
- `logging-config.ts` — Logging level configuration

```typescript
import { SystemConfig } from '@/lib/config/system-config';

const maxRetries = SystemConfig.get('SEARCH_MAX_RETRIES');
const timeout = SystemConfig.get('JOB_TIMEOUT_MS');
```

To grep: `SystemConfig`, `getConfig`, `environment-validator`

---

## React Hooks (`lib/hooks/`)

Client-side hooks for frontend components:

- `use-billing.ts` — `useBilling()` fetches billing status
- `use-subscription.ts` — `useSubscription()` manages subscription state
- `useTrialCountdown.ts` — `useTrialCountdown()` calculates days remaining
- `use-admin.ts` — `useAdmin()` checks admin status

To grep: `useBilling`, `useSubscription`, `useTrialCountdown`

---

## Utilities (`lib/utils/`)

General-purpose utilities:

- `cn.ts` — Tailwind class merging: `cn('class1', condition && 'class2')`
- `formatters.ts` — Number/date formatting
- `validators.ts` — Input validation helpers

To grep: `cn(`, `formatNumber`, `validateEmail`

---

## Instagram US Reels Pipeline (`lib/instagram-us-reels/`)

The v2 Instagram search is a 6-step pipeline:

```
lib/instagram-us-reels/
├── steps/
│   ├── keyword-expansion.ts  → GPT-4 expands keywords
│   ├── handle-harvest.ts     → Serper finds IG handles
│   ├── profile-screen.ts     → Filter by follower count
│   ├── reel-fetch.ts         → Get last 12 reels
│   ├── transcript-fetch.ts   → Extract transcripts
│   └── scoring.ts            → Score relevance
└── clients/
    ├── gpt.ts                → OpenAI client
    ├── serper.ts             → Serper API client
    └── scrapecreators.ts     → ScrapeCreators client
```

To grep: `runKeywordExpansion`, `harvestHandles`, `fetchReels`, `scoreCreators`

---

## Import Patterns

Always use the `@/` alias for imports:

```typescript
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { PlanValidator } from '@/lib/services/plan-validator';
import { logger, LogCategory } from '@/lib/logging';
```

---

## Next in Chain

For detailed documentation on specific domains:
- `lib/auth/CLAUDE.md` — Authentication system
- `lib/db/CLAUDE.md` — Database schema and queries
- `lib/services/CLAUDE.md` — Business logic services
- `lib/search-engine/CLAUDE.md` — Search job processing
