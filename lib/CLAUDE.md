# CLAUDE.md

## Context
This folder (`lib/`) contains the core business logic, database access, and services.
- **DB:** `db/` (Drizzle ORM).
- **Services:** `services/` (Business Logic).
- **Logging:** `logging/` (Structured Logging).

## Patterns
- **Database Queries:**
  - Located in `db/queries/`.
  - **Must** handle normalized tables (`users`, `userSubscriptions`, etc.) manually.
  - Use `getUserProfile(userId)` for full context.
  - Use `db.transaction` for multi-table writes.
- **Services:**
  - Static classes (e.g., `PlanValidator`).
  - Pass `requestId` to all methods.
  - Log `ACCESS`, `USAGE`, and `ERROR` events.
- **Logging:**
  - Use `BillingLogger` for business events.
  - Use `createCategoryLogger` for technical logs.

## Caution Zones
- **`db/schema.ts`**: The source of truth. Do not modify without migration.
- **`services/plan-validator.ts`**: Critical for revenue. Test thoroughly.
- **`stripe/`**: Payment logic. Handle errors gracefully.

## Do Not
- **Do not** use `console.log`.
- **Do not** write raw SQL if Drizzle can handle it.
- **Do not** bypass the normalized user model. Always use `getUserProfile` or join tables.
