# Runtime Logging Playbook

## Goals
- Keep local development consoles quiet by default (WARN and above only).  
- Persist every structured log to disk so you can inspect historical traces per user, job, or request.  
- Unlock per-category overrides via environment variables without touching code.

> The global console bridge now routes every `console.*` call (server and client) through the centralized logger. Browser consoles stay quiet unless you explicitly opt in, eliminating accidental data exposure.

## Where Logs Go
- **Console:** Pretty, colorized output in development when a message meets the current level gate.  
- **Structured files:** JSON lines are written under `logs/<environment>/`. File names follow `application-YYYY-MM-DD.log` or category-specific patterns (e.g., `api-YYYY-MM-DD.log`).
  - Example: `logs/development/api-2025-10-28.log`
  - Each entry is a single JSON object (safe to pipe into `jq`, `rg`, etc.).

## Key Environment Flags
| Variable | Description | Default |
| --- | --- | --- |
| `SERVER_LOG_LEVEL` | Global minimum level (`debug`, `info`, `warn`, `error`, `critical`). | `warn` in dev, `info` in prod |
| `SERVER_CATEGORY_LOG_LEVELS` | Per-category overrides (`auth:debug,api:info`). | None |
| `SERVER_ENABLE_FILE_LOGS` / `SERVER_DISABLE_FILE_LOGS` | Force structured file persistence on/off. | On in dev, on in prod |
| `SERVER_ENABLE_CONSOLE_LOGS` / `SERVER_DISABLE_CONSOLE_LOGS` | Force console output on/off. | Off in dev, off in prod |
| `SERVER_SUPPRESS_ACCESS_LOGS` | Keep Next.js dev access logs out of stdout (`true`/`false`). | `true` |
| `SERVER_LOG_PRETTY` | Pretty-print console output (`true`/`false`). | `true` when console enabled in dev, `false` in prod |
| `AUTH_TRACE_CONSOLE` | Opt back into raw Clerk auth traces on stdout. | `false` |
| `NEXT_PUBLIC_LOG_BRIDGE_PASSTHROUGH` | Allow browser console to mirror logs (dev helper). | `false` |

## Daily Workflow
1. Run `npm run dev` – only WARN+ messages hit the terminal.  
2. Tail structured logs when you need detail:  
   ```bash
   tail -f logs/development/application-$(date '+%Y-%m-%d').log | jq
   ```
3. Add ad-hoc overrides on demand:  
   ```bash
   SERVER_CATEGORY_LOG_LEVELS="SCRAPING:info,AUTH:debug" npm run dev
   ```
4. Flip console prettification off if you prefer raw JSON:  
   ```bash
   SERVER_LOG_PRETTY=false npm run dev
   ```
5. Use `structuredConsole.<level>(...)` (imported from `@/lib/logging/console-proxy`) instead of `console.*`; lint now blocks raw console usage in `app/`, `lib/`, and `components/`.
6. Console output is disabled by default in development—set `SERVER_ENABLE_CONSOLE_LOGS=true` if you want to see the pretty-formatted stream locally.

## Production Checklist
- Keep console logs disabled (`SERVER_DISABLE_CONSOLE_LOGS=true`) to rely on stdout forwarding only when intentionally enabled.  
- Ship the `logs/production/*.log` directory using your log shipper (Vector, Fluent Bit, etc.).  
- Sample noisy categories via `SERVER_CATEGORY_LOG_LEVELS` (e.g., `API:warn,JOB:info`).  
- Sentry still receives WARN+ automatically; no action required.

## Data Hygiene
- Sensitive fields are redacted by `isSensitiveField` in `lib/logging/constants.ts`.  
- Structured files make it easy to write scrubbing/sampling automations; see `lib/logging/server-writer.ts` for the file layout.  
- Set `AUTH_TRACE_CONSOLE=true` temporarily if you need full Clerk payloads on stdout; otherwise traces live only in JSON files.

## Next Steps
- Attach Vector/Fluent Bit to `logs/<env>` for centralized ingestion.  
- Add ESLint `no-console` (server) with selective overrides to keep ad-hoc logs from creeping back.  
- Extend `scripts/test-logging-system.js` to assert file persistence during CI.
- See `docs/logging/accessing-structured-logs.md` for ready-to-copy `jq` filters when you need to inspect a specific user, job, or request.
