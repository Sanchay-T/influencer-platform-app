# AGENTS.md -# AGENTS.md

## Overview
The `app/api/` directory contains the backend logic for the application. It handles data persistence, billing logic, scraping orchestration, and third-party integrations.

## Structure
- **`admin/`**: System configuration and user management.
- **`billing/`**: Stripe checkout and status.
- **`campaigns/`**: CRUD for campaigns. **Enforces Plan Limits.**
- **`jobs/`**: Background job processing.
- **`qstash/`**: Webhook handlers for Upstash QStash.
- **`scraping/`**: Platform-specific scraping endpoints (TikTok, Instagram).
- **`stripe/`**: Stripe-specific endpoints.
- **`webhooks/`**: Incoming webhooks (Stripe, Clerk).

## Key Rules
1. **Authentication:**
   - Use `getAuthOrTest()` to support both Clerk sessions and test scripts.
   - Return `401` immediately if no user.
2. **Logging & Observability:**
   - Every request MUST generate a `requestId`.
   - Log `REQUEST_START`, `REQUEST_SUCCESS`, and `REQUEST_ERROR`.
   - Log `USAGE` events for billing tracking.
3. **Plan Enforcement:**
   - Before creating resources (Campaigns, Creators), call `PlanValidator`.
   - Respect limits and return structured `403` errors with upgrade prompts.
4. **Webhooks:**
   - **Stripe:** Verify signature. Check idempotency (prevent duplicate processing). Handle race conditions with `checkout-success`.
   - **QStash:** Verify signature.
5. **Error Handling:**
   - Catch all errors.
   - Log full stack traces to `BillingLogger`.
   - Return safe, generic error messages to the client.

## Example
```typescript
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.json({ message: "Hello" });
}
```
