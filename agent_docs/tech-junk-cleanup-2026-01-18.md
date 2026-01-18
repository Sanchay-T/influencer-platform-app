# Tech Junk Cleanup — January 18, 2026

## Summary

Comprehensive codebase cleanup removing ~9,000 lines of debug code, unused files, and technical debt.

**Stats:**
- 112 files changed
- ~9,000 lines removed
- New scanner tool created

---

## What Was Removed

### Critical Fixes
| Issue | Fix |
|-------|-----|
| Dead mock function in `openrouter-service.ts` | Removed `bulkSearchInstagramReels()` returning fake `creator_N` data |
| 14 exposed test/debug API routes | Deleted `/api/test/*`, `/api/debug/*`, `/api/webhooks/stripe` (deprecated) |

### Debug Console.logs (~70+ removed)
| Location | Files Cleaned |
|----------|---------------|
| API Routes | `v2/status`, `v2/worker/dispatch`, `scraping/similar-discovery` |
| Search Engine Core | `pipeline.ts`, `expanded-pipeline.ts`, `parallel-pipeline.ts`, `fetch-worker.ts`, `enrich-worker.ts`, `keyword-expander.ts`, `keyword-generator.ts`, `ai-expansion.ts`, `pipeline-helpers.ts` |
| Search Providers | `instagram-reels-scrapecreators.ts`, `tiktok-keyword.ts`, `job-service.ts`, `runner.ts` |
| UI Components | `keyword/page.jsx`, `useSearchJob.ts` |

### Files Deleted
| Category | Files |
|----------|-------|
| Debug files in root | `debug-*.png`, `debug-*.json`, `debug-*.html`, `*.csv`, `*.bak` |
| Wishlink scripts | 8 scripts (unrelated to Gemz) |
| One-time debug scripts | `check-clerk-user.ts`, `find-corrupted-userids.ts`, `find-userid-in-db.ts`, `verify-logsnag.ts`, `test-all-logsnag-events.ts`, `test-sentry-integration.ts` |
| Old test data | `data/sessions/` (16 directories) |
| Session docs | `session-2026-01-18-logsnag-fix.md`, `sentry-integration-report.md`, `sentry-testing-setup.md` |

### Files Restored (were actually used)
These were initially deleted but restored because they're imported by other modules:
- `lib/billing/subscription-types.ts`
- `lib/billing/trial-utils.ts`
- `lib/billing/disposable-emails.ts`
- `lib/analytics/meta-pixel.ts`
- `lib/analytics/google-analytics.ts`
- `lib/logging/react/*`
- `lib/sentry/client-utils.ts`
- `app/components/analytics/ga4-user-id.tsx`

---

## New Tool: Tech Junk Scanner

Created `scripts/scan-tech-junk.sh` to periodically scan for new tech junk:

```bash
./scripts/scan-tech-junk.sh
```

Scans for:
- Debug console.logs with prefixes (`[GEMZ-DEBUG]`, `[DIAGNOSTIC]`, etc.)
- Hardcoded test-user IDs
- Test emails in code
- Console.logs with emojis
- TODO/FIXME comments
- Debug files in repo

---

## Remaining Items (Acceptable)

### TODOs (7 total — legitimate documentation)
| File | Line | TODO |
|------|------|------|
| `lib/db/schema.ts` | 286 | Remove deprecated columns in future migration |
| `lib/db/schema.ts` | 577 | Consider removing subscription_plans table |
| `lib/jobs/job-processor.ts` | 441 | Implement email sending logic |
| `lib/jobs/job-processor.ts` | 453 | Implement trial expiration logic |
| `lib/logging/logger.ts` | 24, 154 | Re-enable with proper server-only wrapper |
| `lib/services/creator-enrichment.ts` | 690 | Enrichment usage tracking not implemented |

### Test-user in Dev Functions
The `test-user` values in `runStandalone()` functions are acceptable — these are development-only utilities:
- `lib/search-engine/v2/core/pipeline.ts:259`
- `lib/search-engine/v2/core/expanded-pipeline.ts:176`
- `lib/search-engine/v2/core/parallel-pipeline.ts:226`

---

## Verification

```bash
# Type check passed
npm run typecheck

# Scanner shows clean
./scripts/scan-tech-junk.sh
```

---

## To Commit

```bash
git add -A
git commit -m "chore: remove tech junk (~9K lines)

- Remove dead mock function in openrouter-service.ts
- Delete 14 test/debug API routes
- Remove ~70 debug console.log statements
- Delete debug files, wishlink scripts, old test data
- Add tech junk scanner script"
```
