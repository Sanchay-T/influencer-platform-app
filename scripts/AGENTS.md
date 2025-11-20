# AGENTS.md

## Overview
The `scripts/` directory contains standalone scripts for system operations, testing, and analysis. These scripts run outside the Next.js environment.

## Structure
- **`analyze/`**: Scripts for data analysis.
- **`ops/`**: Operational scripts (reset, seed, migrate).
- **`tests/`**: Integration and smoke tests.

## Key Rules
1. **Independence:** Scripts must run independently of the Next.js build.
2. **Idempotency:** Where possible, scripts should be idempotent (safe to run multiple times).
3. **Safety:**
   - Destructive scripts must have safeguards (e.g., require a specific env var or confirmation).
   - Always validate environment variables before starting.
4. **Dependencies:** Use `tsx` for TypeScript execution.

## Example
```typescript
import { db } from '@/lib/db';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
  // ... logic ...
}

main().catch(console.error);
```
