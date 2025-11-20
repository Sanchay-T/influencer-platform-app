# CLAUDE.md - US Reels Agent

## Context
You are in the `us-reels-agent/` directory. This is a sub-project focused on processing Instagram Reels data.

## Local Map
- **Entry Point:** `src/index.ts`
- **Tests:** `test-*.ts` files in the root of this folder.
- **Scripts:** `monitor-agents.sh`, `run-parallel-agents.sh` for operations.

## Local Patterns
- **Execution:** Use `tsx` to run TypeScript files directly during development.
- **Data Handling:** Be careful with data in `data/`. It may be used by other processes.
- **Logging:** Check `logs/` for output debugging.

## TDD Specifics
- When modifying transcript logic, run `npm run test:transcript`.
- When modifying search logic, run `npm run test:serper`.
- Create new `test-*.ts` files for new features.

## Navigation
- Go up to `../` for the main project root.
