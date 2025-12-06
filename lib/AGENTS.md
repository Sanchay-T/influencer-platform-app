# AGENTS.md

## Overview
The `lib/` directory contains the core domain logic, decoupled from the UI. It is the "brain" of the application.

## Structure
- **`auth/`**: Authentication helpers (Clerk wrappers).
- **`config/`**: Environment and system configuration.
- **`db/`**: Drizzle ORM setup, schema, and queries.
  - `queries/`: Reusable database access functions.
  - `schema.ts`: Database definition.
- **`logging/`**: Centralized logging infrastructure.
- **`platforms/`**: Third-party API integrations (TikTok, Instagram).
- **`services/`**: Business logic (Plan validation, Scraping orchestration).
- **`stripe/`**: Payment processing logic.

## Key Rules
1. **Normalized Data:**
   - The user model is normalized. **NEVER** assume a single user table contains all data.
   - Use `getUserProfile` to fetch a complete view.
   - Use `createUser` to handle multi-table insertions transactionally.
2. **Observability:**
   - All services must accept and propagate a `requestId`.
   - Use `BillingLogger` for any action that affects limits or revenue.
3. **Error Handling:**
   - Throw typed errors where possible.
   - Log errors before throwing if they are critical.
4. **Testing:**
   - Logic in `lib/` should be testable via scripts in `test-scripts/`.
   - Avoid hard dependencies on Next.js headers/cookies where possible to allow easier testing.

## Example
```typescript
// lib/services/example-service.ts
export class ExampleService {
  static async performAction(userId: string, requestId: string) {
    await BillingLogger.logAccess('CHECK', '...', userId, {}, requestId);
    // ... logic ...
  }
}
```
