---
status: complete
priority: p1
issue_id: "001"
tags: [security, ssrf, api]
dependencies: []
---

# Fix SSRF In /api/proxy/image (P0 #1)

## Problem Statement

`/api/proxy/image` accepted an arbitrary `url=` and fetched it server-side. This enables SSRF (internal network probing, cloud metadata access) and can be abused as an open proxy.

## Findings

- Endpoint: `app/api/proxy/image/route.ts`
- Behavior (before): accepted any http(s) URL and followed redirects; no protection against private IPs.

## Proposed Solutions

### Option 1: SSRF mitigation via URL validation (implemented)

**Approach:**
- Only allow `http:` / `https:`
- Block non-standard ports
- Block localhost / `.local` / `.internal`
- Resolve DNS and block private/reserved IP ranges
- Validate redirects manually (prevent redirect-to-private SSRF)
- Reject non-image responses (content-type/extension gate)

**Pros:**
- Stops the core SSRF risk without needing to predict every valid CDN hostname.
- Low blast radius for real users.

**Cons:**
- Still allows proxying public images from arbitrary hosts (by design).

**Effort:** ~1 hour

**Risk:** Medium (touches a hot path; mitigated by browser verification)

### Option 2: Strict allowlist of image hostnames

**Approach:** only allow known CDNs (TikTok/IG/YouTube etc.)

**Pros:**
- Strongest reduction in abuse potential.

**Cons:**
- Risky: can break valid images if scraping sources change.

## Recommended Action

Option 1 now (fast SSRF mitigation). Consider Option 2 later if abuse becomes a concern.

## Acceptance Criteria

- [x] Requests to private IPs (e.g. `127.0.0.1`) do not fetch and return a safe placeholder.
- [x] Redirect chains are validated; redirect-to-private is blocked.
- [x] Non-image content types do not get proxied through.
- [x] Public image URLs still render correctly via the proxy.

## Work Log

### 2026-02-12 - SSRF Mitigation Patch

**By:** Codex

**Actions:**
- Implemented URL validation + safe redirect fetch in `app/api/proxy/image/route.ts`.
- Added non-image response blocking (placeholder instead).
- Verified via `agent-browser` on `https://usegemz.ngrok.app/api/proxy/image?...`.

**Verification artifacts:**
- `tmp/verify-ssrf-blocked.png`
- `tmp/verify-ssrf-public-image.png`
- `tmp/verify-ssrf-non-image-placeholder.png`
