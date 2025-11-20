# CLAUDE.md

## Context
This folder (`app/api/`) contains the backend API routes.
- **Auth:** Most routes are protected. Use `getAuthOrTest()`.
- **Logging:** **MANDATORY**. Use `BillingLogger` for all critical actions.
- **Validation:** Use `PlanValidator` for limits.

## Patterns
- **Auth:** `const { userId } = await getAuthOrTest();`
- **Logging:**
  - `requestId = BillingLogger.generateRequestId();`
  - `await BillingLogger.logAPI('REQUEST_START', ...)`
  - `await BillingLogger.logUsage(...)`
- **Validation:**
  - `const validation = await PlanValidator.validateCampaignCreation(userId, requestId);`
  - Return `403` if `!validation.allowed`.
- **Response:** Always return `NextResponse.json`. Handle errors with `500` status.

## Caution Zones
- **Billing Webhooks (`webhooks/stripe/`)**: Idempotency is critical. Check `lastWebhookEvent`.
- **Scraping (`scraping/`)**: Handle timeouts and external failures gracefully.
- **QStash (`qstash/`)**: Verify signatures.

## Do Not
- **Do not** use `console.log`. Use `BillingLogger` or `structuredConsole`.
- **Do not** bypass `PlanValidator` for resource creation (campaigns, searches).
- **Do not** ignore `requestId`. Pass it through to all services.
