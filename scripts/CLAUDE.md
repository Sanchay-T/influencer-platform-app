# scripts/CLAUDE.md — CLI Tools & Operational Scripts

## What This Directory Contains

The `scripts/` directory contains standalone CLI tools for development, testing, debugging, and operations. These scripts run outside of Next.js—they're executed directly with `node` or `tsx`. Use them to inspect user state, test APIs, seed data, and diagnose issues.

Scripts are your Swiss Army knife for development. When something goes wrong, there's probably a script for it.

---

## Directory Structure

```
scripts/
├── User Management
│   ├── find-user-id.js           → Find Clerk user ID from email
│   ├── inspect-user-state.js     → Full user state inspection
│   ├── reset-user-onboarding.js  → Reset onboarding to start
│   ├── delete-user-completely.js → Hard delete user (CAUTION)
│   ├── fix-user-billing-state.js → Fix billing sync issues
│   └── upgrade-user-to-fame-flex.ts → Manually upgrade user plan
├── Database Operations
│   ├── seed-subscription-plans.js → Sync Stripe plans to DB
│   ├── analyze-database.js        → Database performance analysis
│   ├── test-local-db.js          → Test database connectivity
│   └── run-migrations.js         → Run Drizzle migrations
├── Instagram Testing
│   ├── test-instagram-keyword.js           → Test keyword search
│   ├── test-instagram-keyword-comparison.js → Compare providers
│   ├── quick-test-instagram-apis.js        → Quick sanity check
│   └── test-instagram-similar.js           → Test similar search
├── Search Testing
│   ├── test-tiktok-keyword.js    → Test TikTok search
│   ├── test-youtube-keyword.js   → Test YouTube search
│   ├── test-enrichment-api.js    → Test creator enrichment
│   └── test-all-searches.js      → Test all platforms
├── Billing Testing
│   ├── test-subscription-system.js → End-to-end billing test
│   ├── test-stripe-webhook.js      → Test webhook handling
│   └── analyze-billing-system.js   → Billing system analysis
├── Development
│   ├── dev-with-ngrok.js         → Start dev with ngrok tunnel
│   ├── stop-ngrok.js             → Stop ngrok tunnel
│   ├── dev-with-port.js          → Start dev on specific port
│   └── clear-cache.js            → Clear various caches
└── Deployment
    ├── validate-deployment.js    → Production health check
    ├── generate-founder-report.js → Founder metrics report
    └── benchmark-performance.js   → Performance benchmarks
```

---

## Most Used Scripts

### User Inspection (`inspect-user-state.js`)

**The most important debugging script.** Shows complete user state across all 5 normalized tables.

```bash
node scripts/inspect-user-state.js user@example.com
```

**Output includes:**
- User profile (name, email, onboarding step)
- Subscription (plan, trial status, dates)
- Billing (Stripe IDs, card info)
- Usage (current month, limits)
- System data (webhooks, events)

To grep: `inspect-user-state`, `getUserProfile`

### Find User ID (`find-user-id.js`)

Get the Clerk `userId` from an email address.

```bash
node scripts/find-user-id.js user@example.com
# Output: user_2a1b3c4d5e6f
```

Useful for CLI testing with `x-test-user-id` header.

To grep: `find-user-id`

### Reset Onboarding (`reset-user-onboarding.js`)

Reset a user's onboarding state to start fresh.

```bash
node scripts/reset-user-onboarding.js user@example.com
```

**Resets:**
- `onboardingStep` → `'pending'`
- `intendedPlan` → `null`
- `currentPlan` → `'free'`
- Trial dates → `null`

To grep: `reset-user-onboarding`, `resetOnboarding`

### Seed Subscription Plans (`seed-subscription-plans.js`)

Sync plan configuration from Stripe to database.

```bash
node scripts/seed-subscription-plans.js
```

Run this after:
- Creating new Stripe products/prices
- Changing plan limits
- Setting up a new environment

To grep: `seed-subscription-plans`, `syncStripePlans`

---

## Testing Scripts

### Test Instagram Keyword (`test-instagram-keyword.js`)

Test Instagram keyword search with a specific keyword.

```bash
node scripts/test-instagram-keyword.js "fitness tips"
```

Returns sample results and provider metrics.

### Test All Searches (`test-all-searches.js`)

Comprehensive test of all search endpoints.

```bash
node scripts/test-all-searches.js
```

Tests:
- Instagram keyword (v1 and v2)
- Instagram similar
- TikTok keyword
- YouTube keyword
- YouTube similar

### Test Enrichment API (`test-enrichment-api.js`)

Test creator enrichment with sample usernames.

```bash
node scripts/test-enrichment-api.js
```

To grep: `test-enrichment`, `enrichCreators`

---

## Development Scripts

### Start with Ngrok (`dev-with-ngrok.js`)

Start dev server with ngrok tunnel for webhook testing.

```bash
npm run dev:ngrok
# or
node scripts/dev-with-ngrok.js
```

Outputs the ngrok URL to configure in Stripe/Clerk dashboards.

### Stop Ngrok (`stop-ngrok.js`)

Stop the ngrok tunnel.

```bash
npm run ngrok:stop
# or
node scripts/stop-ngrok.js
```

To grep: `dev-with-ngrok`, `stop-ngrok`

---

## Script Patterns

### Environment Setup

All scripts start with:

```javascript
require('dotenv').config({ path: '.env.local' });

const { DATABASE_URL, STRIPE_SECRET_KEY } = process.env;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}
```

### Error Handling

```javascript
async function main() {
  try {
    // ... script logic
    console.log('✅ Success');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
```

### Database Connection

```javascript
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);
```

---

## Running Scripts

**JavaScript (.js):**
```bash
node scripts/script-name.js [args]
```

**TypeScript (.ts):**
```bash
npx tsx scripts/script-name.ts [args]
```

**Via npm (if defined in package.json):**
```bash
npm run script:name
```

---

## Caution: Destructive Scripts

These scripts modify data. Use carefully:

- `delete-user-completely.js` — **Permanent deletion**
- `reset-user-onboarding.js` — Resets user state
- `fix-user-billing-state.js` — Modifies billing data

**Always:**
1. Verify you have the correct email/user
2. Run `inspect-user-state.js` first
3. Have a database backup
4. Never run on production without confirmation

---

## Creating New Scripts

Follow this template:

```javascript
#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL);
  const db = drizzle(sql);

  try {
    // Your script logic here
    console.log('✅ Done');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
```

---

## Next in Chain

- For database schema these scripts query, see `lib/db/CLAUDE.md`
- For API routes you might test, see `app/api/CLAUDE.md`
