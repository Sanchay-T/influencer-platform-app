# Sentry & Testing Setup Guide

This document explains how to configure Sentry error tracking and use the testing infrastructure.

## Quick Start

### 1. Set Up Sentry

1. **Create a Sentry Project**
   - Go to [sentry.io](https://sentry.io) and create a new Next.js project
   - Note your DSN, organization slug, and project name

2. **Add Environment Variables**
   ```bash
   # .env.local (and Vercel environment variables)

   # Required for error tracking
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

   # Required for source map uploads (CI/CD)
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=your-project-name
   SENTRY_AUTH_TOKEN=sntrys_xxx  # Generate in Sentry settings

   # Optional: Enable in development
   SENTRY_DEV_ENABLED=true
   ```

3. **Verify Sentry is Working**
   ```bash
   npm run sentry:test
   ```

### 2. Run Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode (for development)
npm run test:unit:watch

# Run tests with coverage report
npm run test:unit:coverage

# Run tests for CI (verbose output)
npm run test:ci
```

## Architecture

### Sentry Configuration Files

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Browser-side error tracking |
| `sentry.server.config.ts` | Node.js server error tracking |
| `sentry.edge.config.ts` | Edge runtime error tracking |
| `instrumentation.ts` | Next.js instrumentation hook |
| `next.config.mjs` | Sentry webpack plugin integration |

### Error Tracking Components

| Component | Purpose |
|-----------|---------|
| `lib/logging/sentry-logger.ts` | Bridge between logging system and Sentry |
| `lib/sentry/feature-tracking.ts` | Feature-specific error tracking helpers |
| `components/ui/error-boundary.tsx` | React error boundary with Sentry integration |

## Feature Tracking

Use the feature trackers for comprehensive error tracking:

```typescript
import { searchTracker, billingTracker, onboardingTracker } from '@/lib/sentry';

// Track a search operation
await searchTracker.trackSearch({
  platform: 'tiktok',
  searchType: 'keyword',
  userId: 'user_123',
  campaignId: 'camp_456',
}, async () => {
  // Your search code here
  return results;
});

// Track billing events
billingTracker.trackCheckout({
  userId: 'user_123',
  planId: 'viral_surge',
  billingCycle: 'monthly',
  isUpgrade: true,
});

// Track onboarding steps
onboardingTracker.trackStep('plan_selected', {
  userId: 'user_123',
  duration: 45000,
});
```

## Error Boundary Usage

Wrap feature components with error boundaries:

```tsx
import { ErrorBoundary } from '@/components/ui/error-boundary';

// In your component
<ErrorBoundary feature="search" platform="tiktok">
  <SearchResults />
</ErrorBoundary>

// Or use the HOC
import { withErrorBoundary } from '@/components/ui/error-boundary';

const SafeSearchResults = withErrorBoundary(SearchResults, {
  feature: 'search',
  platform: 'tiktok',
});
```

## Testing Infrastructure

### Test Structure

```
testing/
├── setup.ts              # Global test setup
├── test-utils.ts         # Shared testing utilities
├── __tests__/            # Unit tests organized by feature
│   ├── billing/
│   ├── onboarding/
│   ├── search/
│   ├── campaigns/
│   └── lists/
├── api-suite/            # API integration tests
├── e2e/                  # Playwright E2E tests
└── smoke/                # Quick smoke tests
```

### Writing Tests

```typescript
import { describe, expect, it } from 'vitest';
import { createMockUser, createMockCampaign } from '@/testing/test-utils';

describe('MyFeature', () => {
  it('should do something', () => {
    const user = createMockUser({ plan: 'viral_surge' });
    // ... test logic
    expect(result).toBe(expected);
  });
});
```

### Test Utilities

```typescript
import {
  createMockUser,
  createMockCampaign,
  createMockCreator,
  createMockScrapingJob,
  createMockList,
  createMockRequest,
  createMockAuth,
  createMockDb,
  createMockStripeSession,
  createMockStripeSubscription,
  createMockStripeEvent,
  waitFor,
  delay,
} from '@/testing/test-utils';
```

## CI/CD Pipeline

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs:

1. **Lint & Type Check** - Biome linting and TypeScript check
2. **Unit Tests** - Vitest unit tests
3. **Build Check** - Ensures the app builds successfully
4. **Sentry Release** - Creates a release with source maps (main branch only)

### Running CI Locally

```bash
# Simulate CI pipeline
npm run typecheck && npm run test:ci && npm run build
```

## Environment-Specific Behavior

### Development
- Sentry events logged to console but not sent (unless `SENTRY_DEV_ENABLED=true`)
- Full debug logging enabled
- 100% sampling rate for transactions

### Production
- All errors sent to Sentry
- 10% client-side transaction sampling
- 20% server-side transaction sampling
- Session replay for error sessions

## Troubleshooting

### Sentry Not Capturing Errors

1. Check `SENTRY_DSN` is set correctly
2. Verify errors aren't filtered by `ignoreErrors` in config
3. Check browser console for Sentry initialization logs
4. Try `npm run sentry:test` to send a test event

### Tests Failing

1. Run `npm run test:unit -- --reporter=verbose` for detailed output
2. Check `testing/setup.ts` for mock configuration
3. Verify environment variables are set in test environment

### Build Failing

1. Check for TypeScript errors: `npm run typecheck`
2. Verify all required env vars are set
3. Check Sentry auth token for source map uploads

## Sentry Dashboard Setup

After deployment, configure these alerts in Sentry:

1. **High Error Rate** - Alert if error rate > 1% for 5 minutes
2. **New Issues** - Get notified of new error types
3. **Performance Regression** - Alert on p95 latency increases
4. **Specific Features** - Create alerts for billing/search failures

### Recommended Issue Tags

- `feature`: onboarding, billing, search, campaign, list
- `platform`: tiktok, instagram, youtube
- `searchType`: keyword, similar
- `route`: API route path

## Next Steps

1. **Add more tests** - Aim for 60%+ coverage on critical paths
2. **Configure Sentry alerts** - Set up email/Slack notifications
3. **Add E2E tests** - Expand Playwright tests for user flows
4. **Performance monitoring** - Track key user journeys

---

*Last updated: January 2026*
