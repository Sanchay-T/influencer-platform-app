---
name: test
description: Run tests and fix any failures automatically
---

Run the test suite and handle results:

1. Execute `pnpm test` (or the appropriate test command)
2. If all tests pass, report success
3. If tests fail:
   - Read the failing test output
   - Identify the root cause
   - Fix the code (not the test, unless the test is wrong)
   - Re-run tests to verify the fix
   - Repeat until all tests pass

Also run:
- `pnpm typecheck` — fix any type errors
- `pnpm lint` — fix any lint errors

Report what you fixed and why.
