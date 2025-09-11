# Agent E2E API Testing (Real Auth, No Route Changes)

This guide shows an agent/LLM how to create campaigns and run all scraping flows (TikTok/YouTube/Instagram; keyword + similar) end‑to‑end using real Clerk sessions. Production behavior is preserved — routes still use `auth()`; no bypass and no route edits are required.

## Overview

- Auth: Real Clerk session JWTs minted via the Clerk Admin API.
- Middleware: Default `clerkMiddleware` is enabled (required for `auth()`).
- Runner: Token auto‑refresh during polling so long jobs don’t fail on 401.
- Output: Full JSON is saved under `logs/`, with an optional “top 5” summary per run.

## Prerequisites

- Clerk environment set in `.env.development` / `.env.worktree`:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - Ensure middleware is active in `middleware.ts` using `clerkMiddleware`.
- Site URL for callbacks (QStash):
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3002` (or your ngrok URL)
- Agent user exists in Clerk (e.g., `agent+dev@example.com`) and in the DB with a usable plan.
  - Use `scripts/bootstrap-agent-user.ts` to create & upgrade to `fame_flex` with `onboardingStep=completed`.

## Key Scripts

- `test-scripts/mint-dev-token.js`
  - Prints a fresh Clerk session JWT for `agent+dev@example.com`.
  - Reads `.env.worktree` then `.env.development`.

- `test-scripts/run-api-bearer.js`
  - Call any route using `--token` or `--cookie`.
  - Example: `node test-scripts/run-api-bearer.js --path /api/campaigns --method POST --token "$(node test-scripts/mint-dev-token.js)" --body '{"name":"Agent","searchType":"tiktok"}'`

- `test-scripts/poll-job-bearer.js`
  - Poll job status with Bearer token.
  - Supports `--token-cmd` to mint/refresh a token when 401 is encountered.
  - Example: `node test-scripts/poll-job-bearer.js --site http://localhost:3002 --path /api/scraping/tiktok --token-cmd "node test-scripts/mint-dev-token.js" --job-id <id>`

- `test-scripts/run-and-poll-bearer.js`
  - One‑shot: start a job, then poll to completion with token auto‑refresh.
  - Saves final JSON to `--out <file>`.

- `test-scripts/extract-top5.js`
  - Summarize a completed job’s JSON into a concise “top 5” list.

## Typical Flow

1) Mint a token on demand

```bash
node test-scripts/mint-dev-token.js
```

2) Create a campaign (Bearer)

```bash
node test-scripts/run-api-bearer.js \
  --path /api/campaigns \
  --method POST \
  --token "$(node test-scripts/mint-dev-token.js)" \
  --body '{"name":"Agent Campaign","description":"E2E","searchType":"tiktok"}'
```

Copy the returned `campaignId`.

3) Start a job and poll to completion (auto‑refresh)

```bash
node test-scripts/run-and-poll-bearer.js \
  --site http://localhost:3002 \
  --start /api/scraping/tiktok \
  --start-body '{"keywords":["iphone 17 pro"],"targetResults":100,"campaignId":"<campaignId>"}' \
  --out logs/tiktok_keyword_iphone17pro.json \
  --token-cmd "node test-scripts/mint-dev-token.js"
```

4) Extract a quick summary

```bash
node test-scripts/extract-top5.js logs/tiktok_keyword_iphone17pro.json \
  | tee logs/tiktok_keyword_iphone17pro.top5.json
```

## Route Examples (All 6 Searches)

Replace `<campaignId>` with the ID created in step 2.

TikTok Keyword

```bash
node test-scripts/run-and-poll-bearer.js \
  --site http://localhost:3002 \
  --start /api/scraping/tiktok \
  --start-body '{"keywords":["iphone 17 pro"],"targetResults":100,"campaignId":"<campaignId>"}' \
  --out logs/tiktok_keyword_iphone17pro.json \
  --token-cmd "node test-scripts/mint-dev-token.js"
```

TikTok Similar

```bash
node test-scripts/run-and-poll-bearer.js \
  --site http://localhost:3002 \
  --start /api/scraping/tiktok-similar \
  --start-body '{"username":"@mkbhd","campaignId":"<campaignId>"}' \
  --out logs/tiktok_similar_mkbhd.json \
  --token-cmd "node test-scripts/mint-dev-token.js"
```

YouTube Keyword

```bash
node test-scripts/run-and-poll-bearer.js \
  --site http://localhost:3002 \
  --start /api/scraping/youtube \
  --start-body '{"keywords":["iphone 17 pro"],"targetResults":100,"campaignId":"<campaignId>"}' \
  --out logs/youtube_keyword_iphone17pro.json \
  --token-cmd "node test-scripts/mint-dev-token.js"
```

YouTube Similar

```bash
node test-scripts/run-and-poll-bearer.js \
  --site http://localhost:3002 \
  --start /api/scraping/youtube-similar \
  --start-body '{"username":"MKBHD","campaignId":"<campaignId>"}' \
  --out logs/youtube_similar_MKBHD.json \
  --token-cmd "node test-scripts/mint-dev-token.js"
```

Instagram Keyword (Hashtag)

```bash
node test-scripts/run-and-poll-bearer.js \
  --site http://localhost:3002 \
  --start /api/scraping/instagram-hashtag \
  --start-body '{"keywords":["iphone"],"targetResults":100,"campaignId":"<campaignId>"}' \
  --out logs/instagram_hashtag_iphone.json \
  --token-cmd "node test-scripts/mint-dev-token.js"
```

Instagram Similar

```bash
node test-scripts/run-and-poll-bearer.js \
  --site http://localhost:3002 \
  --start /api/scraping/instagram \
  --start-body '{"username":"instagram","campaignId":"<campaignId>"}' \
  --out logs/instagram_similar_instagram.json \
  --token-cmd "node test-scripts/mint-dev-token.js"
```

## Notes & Troubleshooting

- 401 during polling: Use `--token-cmd` so the poller refreshes the Bearer token on demand.
- 500 on Instagram hashtag GET status: If encountered, re‑run; if persistent, investigate `/api/scraping/instagram-hashtag` GET handler for error surfaces.
- QStash callbacks: Ensure `NEXT_PUBLIC_SITE_URL` is reachable (localhost or ngrok). Jobs can progress without ngrok in some flows, but webhooks need a public URL.
- Plans/gating: Use `scripts/bootstrap-agent-user.ts` to upgrade the agent user to `fame_flex`, mark `subscriptionStatus=active`, `onboardingStep=completed`.
- Storage: All final job payloads are written to `logs/*.json`; use `test-scripts/extract-top5.js` to generate concise summaries.

## Optional (Dev Only): Session Exchange Route

We also added a dev‑only `/api/internal/session-exchange` route that can mint a session and return `Set-Cookie: __session=...`. This is disabled in production and guarded by `SESSION_EXCHANGE_KEY`. The Bearer token flow above is recommended and does not require using this route.

---

With these commands and scripts, an agent/LLM can create campaigns and run all scraping flows end‑to‑end — using real Clerk auth — without modifying any API routes.

