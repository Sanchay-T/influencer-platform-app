# instagram-us-reels-search/CLAUDE.md — IG Search Scripts
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md.

## Scope
Standalone scripts experimenting with Instagram keyword/similar search pipelines.

## Map
- `production-search.ts`, `production-search-v2.ts` — main runners.
- `ai-powered-search.ts` — AI-driven variant.
- JSON files — captured outputs.

## Patterns
- Run via `npm run <script>` or `tsx <file>`.
- Concurrency controlled with `p-limit`; adjust carefully to avoid provider throttling.
- Validate outputs by inspecting generated JSON.

## Navigation
Return to repo root for production search engine in `lib/search-engine/`.
