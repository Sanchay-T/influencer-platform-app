# TESTING.md — Test-Driven Development Guide

This guide enforces Test-Driven Development (TDD) for all new features. Following TDD ensures code quality, prevents regressions, and maintains system stability.

**Rule: No feature is complete until tests pass.**

---

## TDD Workflow (The Red-Green-Refactor Cycle)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TDD CYCLE (MANDATORY FOR ALL FEATURES)               │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │  1. RED  │  →   │ 2. GREEN │  →   │3.REFACTOR│
    │  Write   │      │  Write   │      │  Clean   │
    │  failing │      │  minimal │      │  up code │
    │  test    │      │  code to │      │  (tests  │
    │          │      │  pass    │      │  still   │
    │          │      │          │      │  pass)   │
    └──────────┘      └──────────┘      └──────────┘
         ↑                                    │
         └────────────────────────────────────┘
                       REPEAT
```

### Step-by-Step Process

1. **RED: Write a Failing Test First**
   ```bash
   # Create test file
   touch test-scripts/feature-name.test.ts

   # Write test that describes expected behavior
   # Run test - it MUST fail (proves test is valid)
   npx tsx test-scripts/feature-name.test.ts
   # Expected: ❌ Test failed
   ```

2. **GREEN: Write Minimal Code to Pass**
   ```bash
   # Implement ONLY enough code to make test pass
   # No extra features, no premature optimization

   # Run test again
   npx tsx test-scripts/feature-name.test.ts
   # Expected: ✅ Test passed
   ```

3. **REFACTOR: Clean Up (Tests Still Pass)**
   ```bash
   # Improve code quality while keeping tests green
   # Remove duplication, improve naming, simplify

   # Run test to verify no regression
   npx tsx test-scripts/feature-name.test.ts
   # Expected: ✅ Test passed
   ```

4. **COMMIT: Only After Tests Pass**
   ```bash
   git add .
   git commit -m "feat: add feature-name with tests"
   ```

---

## Test File Locations & Naming

### Directory Structure

```
test-scripts/                    → Primary test directory
├── search/                      → Search provider tests
│   ├── keyword/                 → Keyword search tests
│   │   ├── instagram-v2-normalization.test.ts
│   │   ├── tiktok-keyword.test.ts
│   │   └── youtube-keyword.test.ts
│   ├── similar/                 → Similar search tests
│   │   ├── instagram-similar.test.ts
│   │   └── youtube-similar.test.ts
│   └── serp/                    → Google SERP tests
├── instagram-us-reels/          → Instagram v2 pipeline tests
│   ├── handle-harvest.test.ts
│   ├── profile-screen.test.ts
│   └── scoring.test.ts
├── helpers/                     → Test utilities
│   └── load-env.ts              → Environment loader
├── ui/                          → UI component tests
└── [feature].test.ts            → Feature-level tests

testing/                         → E2E test suites
├── api-suite/                   → API E2E tests
│   ├── shared-e2e.ts            → Shared utilities
│   ├── campaigns-e2e.ts         → Campaign workflows
│   └── runners/                 → Test runners
└── smoke/                       → Quick smoke tests
    └── run-smoke.ts

lib/test-utils/                  → Test utilities
├── subscription-test.ts         → Plan/billing test helpers
└── api-test-helper.ts           → API testing utilities
```

### Naming Conventions

| Test Type | Pattern | Example |
|-----------|---------|---------|
| Unit test | `[feature].test.ts` | `scoring.test.ts` |
| Integration test | `[feature]-integration.test.ts` | `plan-gating.test.ts` |
| E2E test | `[feature]-e2e.ts` | `campaigns-e2e.ts` |
| Smoke test | `[feature]-smoke.test.ts` | `pipeline-smoke.test.ts` |

---

## Test Templates

### Template 1: Unit Test (Function/Service)

Use for testing individual functions or service methods.

```typescript
// test-scripts/[feature].test.ts
import './helpers/load-env';
import assert from 'node:assert/strict';

// ============================================================================
// TEST: [Feature Name]
// ============================================================================

interface TestCase {
  name: string;
  input: unknown;
  expected: unknown;
}

const TEST_CASES: TestCase[] = [
  {
    name: 'should handle normal input',
    input: { /* test input */ },
    expected: { /* expected output */ },
  },
  {
    name: 'should handle edge case: empty input',
    input: {},
    expected: { /* expected output */ },
  },
  {
    name: 'should handle edge case: invalid input',
    input: null,
    expected: { error: 'Invalid input' },
  },
];

async function runTests() {
  console.log('\n🧪 Testing [Feature Name]\n');
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    try {
      // Arrange
      const input = testCase.input;

      // Act
      const result = await functionUnderTest(input);

      // Assert
      assert.deepStrictEqual(result, testCase.expected);

      console.log(`  ✅ ${testCase.name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${testCase.name}`);
      console.log(`     Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
```

### Template 2: API Route Test

Use for testing API endpoints.

```typescript
// test-scripts/api/[endpoint].test.ts
import './helpers/load-env';
import assert from 'node:assert/strict';
import { buildTestAuthHeaders } from '@/lib/tests/agent-auth';

// ============================================================================
// TEST: API [Endpoint Name]
// ============================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = process.env.TEST_USER_ID || 'user_test123';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

interface TestCase {
  name: string;
  method: string;
  path: string;
  body?: Record<string, unknown>;
  expectedStatus: number;
  expectedBody?: Record<string, unknown>;
  skipAuth?: boolean;
}

const TEST_CASES: TestCase[] = [
  {
    name: 'should return 401 without auth',
    method: 'GET',
    path: '/api/campaigns',
    expectedStatus: 401,
    skipAuth: true,
  },
  {
    name: 'should return 200 with valid auth',
    method: 'GET',
    path: '/api/campaigns',
    expectedStatus: 200,
  },
  {
    name: 'should create campaign with valid data',
    method: 'POST',
    path: '/api/campaigns',
    body: {
      name: 'Test Campaign',
      platform: 'instagram',
      keywords: ['fitness'],
    },
    expectedStatus: 201,
  },
  {
    name: 'should return 400 with invalid data',
    method: 'POST',
    path: '/api/campaigns',
    body: {},
    expectedStatus: 400,
  },
];

async function apiFetch(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    skipAuth?: boolean;
  } = {}
) {
  const { method = 'GET', body, skipAuth = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!skipAuth) {
    Object.assign(headers, buildTestAuthHeaders({
      userId: TEST_USER_ID,
      email: TEST_EMAIL,
    }));
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { res, text, json };
}

async function runTests() {
  console.log('\n🧪 Testing API [Endpoint Name]\n');
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    try {
      const { res, json } = await apiFetch(testCase.path, {
        method: testCase.method,
        body: testCase.body,
        skipAuth: testCase.skipAuth,
      });

      // Assert status code
      assert.equal(
        res.status,
        testCase.expectedStatus,
        `Expected status ${testCase.expectedStatus}, got ${res.status}`
      );

      // Assert body if specified
      if (testCase.expectedBody) {
        assert.deepStrictEqual(json, testCase.expectedBody);
      }

      console.log(`  ✅ ${testCase.name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${testCase.name}`);
      console.log(`     Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
```

### Template 3: Integration Test (Multi-Step Workflow)

Use for testing complete user workflows.

```typescript
// test-scripts/integration/[workflow].test.ts
import './helpers/load-env';
import assert from 'node:assert/strict';
import { buildTestAuthHeaders } from '@/lib/tests/agent-auth';
import postgres from 'postgres';

// ============================================================================
// TEST: [Workflow Name] Integration
// ============================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL!;

// Test user (created fresh for each test run)
const testUserId = `test_user_${Date.now()}`;
const testEmail = `test_${Date.now()}@example.com`;

let sql: postgres.Sql;

// Setup: Create test database connection
async function setup() {
  console.log('📦 Setting up test environment...');
  sql = postgres(DATABASE_URL, { max: 1 });

  // Clean up any existing test data
  await sql`DELETE FROM users WHERE user_id LIKE 'test_user_%'`;

  console.log('✅ Setup complete\n');
}

// Teardown: Clean up test data
async function teardown() {
  console.log('\n🧹 Cleaning up...');
  await sql`DELETE FROM users WHERE user_id = ${testUserId}`;
  await sql.end();
  console.log('✅ Cleanup complete');
}

// API helper
async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = buildTestAuthHeaders({ userId: testUserId, email: testEmail });
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

// Test steps
async function testStep1_CreateUser() {
  console.log('Step 1: Create user via onboarding...');

  const { res, json } = await apiFetch('/api/onboarding/step-1', {
    method: 'PATCH',
    body: JSON.stringify({ fullName: 'Test User', businessName: 'Test Biz' }),
  });

  assert(res.ok, `Step 1 failed: ${res.status}`);
  console.log('  ✅ User created');
  return json;
}

async function testStep2_SelectPlan() {
  console.log('Step 2: Select plan...');

  const { res, json } = await apiFetch('/api/onboarding/save-plan', {
    method: 'POST',
    body: JSON.stringify({ selectedPlan: 'glow_up' }),
  });

  assert(res.ok, `Step 2 failed: ${res.status}`);
  console.log('  ✅ Plan selected');
  return json;
}

async function testStep3_VerifyLimits() {
  console.log('Step 3: Verify plan limits...');

  const { res, json } = await apiFetch('/api/billing/status');

  assert(res.ok, `Step 3 failed: ${res.status}`);
  assert.equal(json.planKey, 'glow_up');
  assert.equal(json.campaignsLimit, 3);
  console.log('  ✅ Limits verified');
  return json;
}

// Main test runner
async function runTests() {
  console.log('\n🧪 Integration Test: [Workflow Name]\n');

  try {
    await setup();

    await testStep1_CreateUser();
    await testStep2_SelectPlan();
    await testStep3_VerifyLimits();

    console.log('\n✅ All integration tests passed!\n');
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  } finally {
    await teardown();
  }
}

runTests();
```

### Template 4: E2E Test (Full System)

Use for end-to-end testing with the E2E framework.

```typescript
// testing/api-suite/[feature]-e2e.ts
import { createContext, requestJson, pollJobUntilComplete, E2EContext } from './shared-e2e';

// ============================================================================
// E2E TEST: [Feature Name]
// ============================================================================

async function runE2ETest(ctx: E2EContext) {
  console.log('\n🧪 E2E Test: [Feature Name]\n');

  // Step 1: Create resource
  console.log('Step 1: Creating resource...');
  const resource = await requestJson(ctx, '/api/resource', {
    body: { name: 'Test Resource' },
    label: 'Create resource',
  });
  console.log(`  ✅ Created: ${resource.id}`);

  // Step 2: Trigger async job
  console.log('Step 2: Triggering job...');
  const job = await requestJson(ctx, `/api/resource/${resource.id}/process`, {
    body: { action: 'process' },
    label: 'Trigger job',
  });
  console.log(`  ✅ Job started: ${job.jobId}`);

  // Step 3: Poll for completion
  console.log('Step 3: Waiting for completion...');
  const result = await pollJobUntilComplete(ctx, job.jobId, {
    maxAttempts: 60,
    delayMs: 2000,
  });
  console.log(`  ✅ Job completed: ${result.processedResults} items`);

  // Step 4: Verify results
  console.log('Step 4: Verifying results...');
  const details = await requestJson(ctx, `/api/resource/${resource.id}`);
  if (details.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${details.status}'`);
  }
  console.log('  ✅ Results verified');

  console.log('\n✅ E2E Test passed!\n');
}

// Main
const ctx = createContext();
runE2ETest(ctx).catch((error) => {
  console.error('❌ E2E Test failed:', error);
  process.exit(1);
});
```

---

## Running Tests

### Individual Test

```bash
# Run a specific test
npx tsx test-scripts/feature-name.test.ts

# Run with environment variables
ENABLE_TEST_AUTH=true npx tsx test-scripts/plan-gating.test.ts
```

### Test Suites

```bash
# Run all search tests
npm run test:search:instagram:v2
npm run test:search:tiktok:keyword
npm run test:search:youtube:keyword

# Run plan/billing tests
npm run test:plans

# Run smoke tests (quick validation)
npm run smoke:test

# Run E2E suite
npx tsx testing/api-suite/full-e2e.ts
```

### Pre-Commit Tests

Before committing, run these tests:

```bash
# Quick smoke test
npm run smoke:test

# Type check
npx tsc --noEmit

# Lint check
npm run lint
```

---

## Test Coverage by Feature

### Existing Tests (Reference These)

| Feature | Test File | Run Command |
|---------|-----------|-------------|
| Plan Enforcement | `test-scripts/plan-gating.test.ts` | `npm run test:plans` |
| Instagram v2 Pipeline | `test-scripts/instagram-us-reels/*.test.ts` | Multiple |
| TikTok Keyword | `test-scripts/search/keyword/tiktok-keyword.test.ts` | `npm run test:search:tiktok:keyword` |
| YouTube Keyword | `test-scripts/search/keyword/youtube-keyword.test.ts` | `npm run test:search:youtube:keyword` |
| Instagram Similar | `test-scripts/search/similar/instagram-similar.test.ts` | `npm run test:search:instagram:similar` |
| Campaigns E2E | `testing/api-suite/campaigns-e2e.ts` | `npx tsx testing/api-suite/campaigns-e2e.ts` |
| Full E2E | `testing/api-suite/full-e2e.ts` | `npx tsx testing/api-suite/full-e2e.ts` |

### Required Tests for New Features

| Feature Type | Required Tests |
|--------------|----------------|
| New API Route | Unit test + API test |
| New Service | Unit test for each method |
| New Search Provider | Provider test + integration test |
| New Webhook Handler | Unit test + idempotency test |
| Database Change | Migration test + query test |
| UI Component | Component test (if logic present) |

---

## Testing Utilities

### Test Auth Headers

```typescript
import { buildTestAuthHeaders } from '@/lib/tests/agent-auth';

const headers = buildTestAuthHeaders({
  userId: 'user_test123',
  email: 'test@example.com',
});
// Use headers in fetch calls
```

### Environment Loading

```typescript
// At top of every test file
import './helpers/load-env';

// This loads .env.local, .env.development, .env
```

### Database Direct Access

```typescript
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

// Setup test data
await sql`INSERT INTO users (user_id, email) VALUES (${'test_user'}, ${'test@example.com'})`;

// Cleanup
await sql`DELETE FROM users WHERE user_id LIKE 'test_%'`;
await sql.end();
```

### Subscription Test Utils

```typescript
import { SubscriptionTestUtils } from '@/lib/test-utils/subscription-test';

// Create test users with different plans
const testUsers = await SubscriptionTestUtils.createTestUsers();

// Reset usage counters
await SubscriptionTestUtils.resetUsageCounters('user_id');
```

### Job Polling

```typescript
import { pollJobUntilComplete } from './shared-e2e';

const result = await pollJobUntilComplete(ctx, jobId, {
  maxAttempts: 120,  // Max poll attempts
  delayMs: 5000,     // Delay between polls
});
```

---

## Agent TDD Checklist

Before starting ANY new feature:

```
□ 1. Create test file in test-scripts/
□ 2. Write failing test that describes expected behavior
□ 3. Run test - verify it FAILS (red)
□ 4. Implement minimal code to pass
□ 5. Run test - verify it PASSES (green)
□ 6. Refactor if needed (tests still pass)
□ 7. Add edge case tests
□ 8. Run full test suite to check for regressions
□ 9. Commit with tests
```

### When to Write Which Test

```
Creating new API endpoint?
└── Write API route test (Template 2)

Creating new service method?
└── Write unit test (Template 1)

Creating multi-step workflow?
└── Write integration test (Template 3)

Testing full user journey?
└── Write E2E test (Template 4)

Fixing a bug?
└── Write regression test that reproduces the bug FIRST
```

---

## Common Testing Patterns

### Pattern 1: Test Data Cleanup

Always clean up test data:

```typescript
// At start of test
await sql`DELETE FROM users WHERE user_id LIKE 'test_%'`;

// In finally block
try {
  // tests
} finally {
  await sql`DELETE FROM users WHERE user_id = ${testUserId}`;
  await sql.end();
}
```

### Pattern 2: Async Job Testing

For testing background jobs:

```typescript
// 1. Trigger job
const { jobId } = await triggerJob();

// 2. Poll until complete or timeout
const maxAttempts = 60;
for (let i = 0; i < maxAttempts; i++) {
  const status = await getJobStatus(jobId);
  if (status === 'completed') break;
  if (status === 'error') throw new Error('Job failed');
  await sleep(2000);
}

// 3. Verify results
const results = await getJobResults(jobId);
assert(results.length > 0);
```

### Pattern 3: Error Case Testing

Always test error scenarios:

```typescript
// Test 401 - No auth
const noAuthRes = await fetch(url);
assert.equal(noAuthRes.status, 401);

// Test 400 - Invalid input
const invalidRes = await fetch(url, { body: JSON.stringify({}) });
assert.equal(invalidRes.status, 400);

// Test 403 - Plan limit
const limitRes = await fetch(url); // After hitting limit
assert.equal(limitRes.status, 403);

// Test 404 - Not found
const notFoundRes = await fetch(`${url}/nonexistent`);
assert.equal(notFoundRes.status, 404);
```

### Pattern 4: Idempotency Testing

For webhooks:

```typescript
// Send same webhook twice
await handleWebhook(event);
await handleWebhook(event); // Should be ignored

// Verify only processed once
const user = await getUserProfile(userId);
assert.equal(user.processedCount, 1);
```

---

## Test Command Reference

```bash
# ─────────────────────────────────────────────────────────────────────────────
# SEARCH TESTS
# ─────────────────────────────────────────────────────────────────────────────
npm run test:search:instagram:v2        # Instagram v2 normalization
npm run test:search:tiktok:keyword      # TikTok keyword search
npm run test:search:youtube:keyword     # YouTube keyword search
npm run test:search:instagram:similar   # Instagram similar search
npm run test:search:tiktok:similar      # TikTok similar search
npm run test:search:youtube:similar     # YouTube similar search

# ─────────────────────────────────────────────────────────────────────────────
# BILLING & PLAN TESTS
# ─────────────────────────────────────────────────────────────────────────────
npm run test:plans                      # Full plan enforcement suite

# ─────────────────────────────────────────────────────────────────────────────
# THIRD-PARTY API TESTS
# ─────────────────────────────────────────────────────────────────────────────
npm run test:modash:instagram:search    # Modash Instagram API
npm run test:modash:instagram:report    # Modash report generation

# ─────────────────────────────────────────────────────────────────────────────
# SMOKE TESTS
# ─────────────────────────────────────────────────────────────────────────────
npm run smoke:test                      # Quick E2E smoke test

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM VALIDATION
# ─────────────────────────────────────────────────────────────────────────────
npm run validate:deployment             # Deployment health check
npm run health:check                    # Basic health check
npm run test:logging                    # Logging system verification
```

---

## Next Steps

1. Read existing tests for your feature area
2. Copy the appropriate template
3. Write your tests BEFORE implementing
4. Follow the Red-Green-Refactor cycle
5. Run full suite before committing

**Remember: Tests are documentation. They show how the code should behave.**
