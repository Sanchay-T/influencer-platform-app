# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-001
**Title:** V2 Fan-Out Architecture — Frontend Integration
**Status:** 🟡 IN_PROGRESS
**Branch:** `UAT`
**Started:** Dec 8, 2025
**Updated:** Dec 11, 2025

### Goal
Connect the V2 fan-out search system to the frontend UI so users can run searches through the new architecture.

### Checklist
- [x] Phase 1: Database schema changes *(sequential)*
- [x] Phase 2: Core infrastructure *(sequential)*
- [x] Phase 3: Workers *(sequential)*
- [x] Phase 4: API routes *(sequential)*
- [x] Phase 5: Platform adapters *(delegate)*
- [x] Phase 6: Adaptive re-expansion *(sequential)*
- [x] Phase 7: E2E testing *(background)*
- [ ] **Phase 8: Frontend integration** ← YOU ARE HERE *(sequential)*
- [ ] Phase 9: Cleanup *(delegate)*

**Markers:** `*(sequential)*` = do in order | `*(delegate)*` = can parallelize | `*(background)*` = run while doing other work

### Next Action
```
1. Open: app/components/campaigns/keyword-search/keyword-search-form.jsx
2. Find the form submission handler
3. Change it to call /api/v2/dispatch instead of old endpoint
4. Update the polling to use /api/v2/status?jobId=xxx
```

### Key Files
| Purpose | File |
|---------|------|
| Form UI | `app/components/campaigns/keyword-search/keyword-search-form.jsx` |
| Results UI | `app/components/campaigns/keyword-search/search-results.jsx` |
| V2 Dispatch | `app/api/v2/dispatch/route.ts` |
| V2 Status | `app/api/v2/status/route.ts` |
| Architecture | `agent_docs/v2-fan-out-architecture.md` |

### Context
- All 3 platforms tested and working (YouTube 109%, TikTok 98%, Instagram 100%)
- Test script: `npx tsx scripts/test-v2-dispatch.ts --platform=tiktok --target=100`
- No blockers

---

## Backlog

| ID | Title | Priority | Notes |
|----|-------|----------|-------|
| TASK-002 | Refactor search-results.jsx | High | 2888 lines → split into components |
| TASK-003 | Add test coverage for V2 | Medium | Unit tests for adapters |
| TASK-004 | Delete legacy search code | Low | After V2 frontend works |

---

## Completed

| ID | Title | Completed |
|----|-------|-----------|
| — | V2 Core Implementation | Dec 11, 2025 |
| — | Adaptive Re-Expansion | Dec 11, 2025 |
| — | Claude Code Hooks Setup | Dec 11, 2025 |

---

*Last updated by PreCompact hook. If you see this after context cleared, you're in the right place.*
