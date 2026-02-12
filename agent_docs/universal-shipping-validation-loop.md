# Universal Shipping Validation Loop (Web Apps)

## Purpose
Use one repeatable developer loop for every feature so backend, frontend, manual UX checks, and automated tests stay aligned.

This document is intentionally universal. It is not tied to Gemz-only pages or endpoints.

## One-Line Pointer (for future use in AGENTS.md / CLAUDE.md)
`Follow the shipping loop in /Users/sanchay/Documents/projects/personal/gemz/agent_docs/universal-shipping-validation-loop.md for all feature work.`

## Decision-Locked Defaults (v1)
These defaults are set from product-owner decisions and should be treated as policy:
1. Manual browser validation is mandatory for UI-affecting changes.
2. Manual validation runs in a spawned sub-agent so primary work can continue.
3. Spawn browser validation only when the primary agent marks the feature slice as complete (backend + frontend wired + local sanity pass).
4. After manual pass, the primary agent asks the user for confirmation before spawning test-codification agent.
5. Server lifecycle must be dynamic (discovered from repository), not hardcoded.
6. Strict rule: no new lint/type/test errors in touched files.
7. Auth-dependent flows default to real user simulation when credentials and providers are available.
8. Artifacts are mandatory and must be saved with run ID and feature label.

## Definition of Done (Single Standard)
A feature is done only when all of this is true:
1. Backend behavior works and is validated.
2. Frontend is wired and works with real backend responses.
3. Human-like browser flow is validated end-to-end.
4. The manual flow is codified into automated tests (Playwright + targeted unit/integration).
5. Quality gates pass for touched files (format/lint/type/test).

## Agent Topology (Non-Blocking)
Use this role split by default:
1. Primary agent: implement feature and keep momentum.
2. Browser validation sub-agent: run manual UX flow with screenshots and API proof capture.
3. Test codifier sub-agent: generate Playwright + backend tests after manual pass is approved.

Control flow:
1. Primary agent verifies feature-slice completion gate:
   1. backend contract implemented
   2. frontend wiring complete
   3. happy-path sanity check passed
2. Primary agent spawns browser validator only after the completion gate passes.
3. Browser validator returns evidence pack.
4. Primary agent asks user: approve manual result?
5. If approved, primary agent spawns test codifier.
6. Primary agent runs final quality gates and reports.

## The Loop (Always Same Order)

### 1. Build Slice
Implement the smallest complete slice (API + UI + wiring) before expanding scope.

Output:
1. Code compiles for touched files.
2. Endpoint contract and UI state transitions are explicit.

### 2. Fast Backend Validation
Validate core backend behavior before browser traversal.

Minimum checks:
1. Happy path response.
2. Auth/permission failure path.
3. Validation/error path.
4. Data persistence side effects (if any).

Output:
1. Backend behavior confirmed with deterministic inputs.

### 3. Human Browser Validation (Agent Browser)
Run the feature as a user would, not just via API calls.

Required steps:
1. Start local server.
2. Open relevant page.
3. Execute primary user flow end-to-end.
4. Capture screenshots at milestones.
5. Record key API payload checks for rendered state correctness.
6. Follow the no-assumptions rule: do not guess UI controls by heuristics when multiple inputs/actions exist.
   1. Use `agent-browser snapshot -i` to discover interactive elements.
   2. Use `agent-browser network requests` to prove the intended action triggered the intended request.
   3. If multiple candidates match, disambiguate by outcome (URL + network evidence), not by guessing.

Output:
1. Milestone screenshots.
2. Brief evidence log of key observed behavior.
3. When the chat client supports local image rendering, embed milestone screenshots inline using Markdown image tags with absolute paths (e.g., `![01-entry](/abs/path.png)`), not just file paths.

### 4. Codify What Worked
Turn the manual proof into automation immediately.

Required automation:
1. Playwright spec for the user flow that just passed manually.
2. Targeted backend tests for contracts and failure cases.
3. Shared fixture/test data where possible.

Output:
1. New or updated deterministic tests for the exact flow.

### 5. Quality Gate Before Exit
Run gates before considering the slice complete.

Required gates:
1. Formatter/linter on changed files.
2. Targeted test suite for touched behavior.
3. Type checks per project policy (strict no-new-errors on touched files).

Output:
1. Green gates for the changed slice.
2. Explicit note of any known baseline debt not introduced by this slice.

## Dynamic Server Lifecycle (Universal, No Hardcoding)
The agent must discover how to run and manage the server from repo context.

### Discovery order
1. Detect package manager by lockfiles:
   1. `pnpm-lock.yaml` -> `pnpm`
   2. `yarn.lock` -> `yarn`
   3. `package-lock.json` -> `npm`
2. Parse `package.json` scripts and choose startup command in priority:
   1. project-specific dev tunnel command (for browser/webhook flows), for example `dev:ngrok`
   2. standard `dev`
   3. framework fallback (`next dev`, `vite`, etc.) only if scripts are missing
3. Resolve target port:
   1. explicit env (`LOCAL_PORT`, `PORT`)
   2. script-declared `-p` value
   3. framework default (`3000`)
4. Resolve health endpoint:
   1. `/api/health` if present
   2. `/health` fallback
   3. root page `/` as last fallback

### Conflict handling
1. If target port is in use:
   1. try graceful stop for process matching current workspace command
   2. if unrelated process, move to next free port and pass override env when supported
2. Verify server by polling health endpoint with timeout and retries.
3. Always return resolved base URL to downstream browser/testing steps.

### Shutdown policy
1. On completion, stop only the process started by the agent.
2. Do not kill unrelated processes on shared machine unless explicitly requested.

## Auth-Dependent Flow Policy
Goal: simulate real user behavior as the final confidence layer.

### Three-Lane Provider Strategy (Prevents Clerk/Stripe Blockers)
Use lanes in order. Promote only when the previous lane is green.

#### Lane A: Deterministic local lane (default for fast iteration)
1. Use local test-auth pathways, seeded fixtures, and provider adapters/stubs.
2. Assert API contracts, state transitions, and gating logic without external callbacks.
3. Treat this as required for every feature slice.

#### Lane B: Provider contract lane (stable integration check)
1. Use real Clerk/Stripe SDK calls in test mode, but avoid brittle UI dependencies.
2. Prefer backend-created test users/sessions and server-side checkout/session verification where possible.
3. For Stripe lifecycle transitions, use test clocks/webhook fixture replay when available to avoid waiting on wall-clock trial windows.

#### Lane C: Real browser lane (release confidence)
1. Run real UI auth path (Clerk sign-up/sign-in) for user-facing workflows.
2. Run Stripe test-mode checkout for billing/trial flows.
3. Verify callbacks plus post-login state after refresh/relogin.
4. Keep this mandatory before merge/release for auth/billing-affecting changes.

### Fast fallback mode (only when blocked)
1. If Lane C flakes due to provider outage/rate limit, do not block implementation validation if Lane A and Lane B are green.
2. Mark build as `provisional-provider-blocked` and capture evidence.
3. Re-run Lane C before merge/release cut.

### Provider setup expectations
1. Clerk test setup must allow automated sign-up/sign-in in non-production test env.
2. Stripe test keys and webhook routing must be valid for local callbacks.
3. Support Stripe test clocks for trial/renewal/cancel scenarios to avoid time-based blocking.
4. If provider flake occurs, preserve evidence and continue only under provisional rules above.

## Default Evidence Pack
For each feature slice, keep:
1. `what-changed`: short bullet summary.
2. `manual-proof`: screenshots + key UI/API observations.
3. `automated-proof`: test names and pass status.
4. `risk-left`: what is still not covered.

## Minimal Template (Copy per Feature)
Use this checklist for each feature branch/task:

1. Scope
1. Backend contract
1. Frontend states
1. Manual flow checkpoints
1. Playwright cases
1. Unit/integration cases
1. Quality gate results
1. Residual risks

## Artifact Convention (Required)
Store artifacts under:
1. `testing/artifacts/v3-proof/<run-id>__<feature-slug>/baseline/...`
2. `testing/artifacts/v3-proof/<run-id>__<feature-slug>/current/...`

Where:
1. `<run-id>` uses timestamp (`YYYYMMDD-HHMMSS`).
2. `<feature-slug>` is short human-readable scope (`campaigns-v2-page`, `trial-upgrade-flow`).

Use predictable milestone names:
1. `01-entry`
2. `02-input-filled`
3. `03-submit-result`
4. `04-success-state`
5. `05-post-refresh`

## Anti-Pattern to Avoid
Do not stop after "it works manually once."

Always convert manual proof into tests in the same cycle, otherwise regressions will reappear.

## Escalation Rule
If a feature cannot be validated manually in browser, do not write final tests yet. Fix environment or flow first, then codify tests.
