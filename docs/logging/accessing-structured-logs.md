# Structured Log Quick Reference

This checklist covers how to inspect the JSON logs the pipeline now writes under `logs/<environment>/`. Every entry is a single JSON object, so they’re easy to slice with `jq`, `rg`, or any JSON-aware tool.

## Where the files live
- Development: `logs/development/`
- Production (when deployed): `logs/production/`
- Category-specific files (daily rotation):
  - `application-YYYY-MM-DD.log` – cross-cutting events (billing, auth, job summaries, structuredConsole output)
  - `scraping-YYYY-MM-DD.log` – platform-specific scraping telemetry
  - `api-YYYY-MM-DD.log` – HTTP request traces (when API logging is enabled)

Tip: the files rotate daily; the current day’s file is usually all you need while debugging.

## Common filters
All commands assume you are in the repo root.

### By user
```bash
jq -c 'select(.context.userId=="<Clerk user id>")' \
  logs/development/application-2025-10-28.log
```

### By job (keyword search, scraper, background worker)
```bash
jq -c 'select(.context.jobId=="<job-id>")' \
  logs/development/scraping-2025-10-28.log
```

### By request ID (matches the `req_*` tokens the app shows)
```bash
jq -c 'select(.context.requestId=="<request-id>")' \
  logs/development/application-2025-10-28.log
```

### Count matches quickly
```bash
jq -c 'select(.context.jobId=="<job-id>")' logs/development/scraping-2025-10-28.log | wc -l
```

### Search by message
Because each entry is a JSON blob, you can still use ripgrep:
```bash
rg "Instagram US Reels keyword" logs/development/scraping-2025-10-28.log
```

## Reading the output
- `message`: human-readable status (`Search runner completed`, `Billing status request received`, etc.).
- `category`: log grouping (API, SCRAPING, JOB, BILLING, DATABASE…).
- `level`: numeric severity (`0=DEBUG`, `1=INFO`, `2=WARN`, `3=ERROR`, `4=CRITICAL`).
- `context`: structured metadata—user IDs, job IDs, request IDs, timing, cache hits, and sanitized payloads (PII is redacted).
- `error`: present on failures (name, message, stack trace).

If you need to pretty-print a single entry:
```bash
jq 'select(.context.jobId=="<job-id>") | .message' logs/development/scraping-2025-10-28.log
```
or pipe to `jq` without `-c` to expand:
```bash
jq 'select(.context.jobId=="<job-id>")' logs/development/scraping-2025-10-28.log
```

## Opt-in console output (optional)
By default the dev server keeps the terminal quiet. To see the pretty-formatted stream again:

```bash
SERVER_ENABLE_CONSOLE_LOGS=true npm run dev
```

To re-enable Next.js access logs during troubleshooting:

```bash
SERVER_SUPPRESS_ACCESS_LOGS=false npm run dev
```

(Remember to restart the dev server after changing these flags.)

## Quick sanity checks
1. `ls logs/development` – confirm the day’s files exist.
2. `tail logs/development/application-*.log` – inspect the latest entries.
3. `jq` filters as shown above.
4. For long investigations, copy the relevant slice into a scratch file:
   ```bash
   jq -c 'select(.context.jobId=="<job-id>")' \
     logs/development/scraping-2025-10-28.log > /tmp/job-dump.log
   ```
   Then open `/tmp/job-dump.log` in your editor for richer tooling.

Future enhancement idea: wrap the common filters in scripts (`npm run logs:tail`, `npm run logs:job <id>`) if we find ourselves repeating the same commands often.
