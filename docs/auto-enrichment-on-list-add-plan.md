# Auto-Enrichment on List Add — Product + Technical Plan

## 1) What the system does today (ground truth)

### Search/results enrichment today
- In the creator table, enrichment is currently **user-triggered** via an `Enrich` button per row and a bulk `Enrich N` action for selected rows.
- UI state is tracked client-side (`loadingMap`, `bulkState`) and each action hits `POST /api/creators/enrich`.
- The enrichment response is merged into local creator state and surfaced via email badges, refresh timestamps, and toasts.

### List add today
- Saving creators to a list is handled by `AddToListButton`, which posts selected creator snapshots to `POST /api/lists/:id/items`.
- Backend `addCreatorsToList` inserts profiles with `onConflictDoNothing`, links them to list items, and returns `{ added, skipped, attempted }`.
- Importantly: list save currently does **not** trigger enrichment; it is a persistence-only flow.

### List detail experience today
- List detail supports board/list views, buckets (`backlog`, etc.), drag/drop, and pinning.
- There is no native per-item enrichment status model in list detail, so users cannot see “queued / in progress / enriched / failed” lifecycle for list-specific enrichment.

---

## 2) Feature objective

When a creator is newly added to a list, enrichment should start automatically in the background (no blocking request/response UX). The UI should:
1. Confirm add success immediately.
2. Show enrichment is queued/processing.
3. Update each creator row/card with enrichment results as they land.
4. Keep list workflows smooth even if enrichment is slow/fails.

---

## 3) Recommended architecture

## 3.1 Trigger model (decoupled)
Use **event + queue**, not inline enrichment inside `/api/lists/:id/items`.

Proposed flow:
1. `POST /api/lists/:id/items` keeps fast add behavior and returns promptly.
2. For each newly inserted creator (not skipped), enqueue an `auto_enrich_list_creator` job with payload:
   - `userId`
   - `listId`
   - `creatorProfileId` (or platform+externalId)
   - `source = list_add_auto`
   - idempotency key: `${listId}:${creatorProfileId}`
3. Worker consumes queue with platform-aware concurrency/rate limits.
4. Worker calls existing enrichment service (`creatorEnrichmentService`) and writes normalized enrichment fields.
5. Worker updates list-item enrichment status and emits events/logs for UI polling.

Why this is best:
- Preserves list add responsiveness.
- Scales enrichment independently.
- Fits existing async worker pattern already used elsewhere in app.

## 3.2 Data model additions
Add list-item level enrichment tracking fields (either on `creator_list_items` or companion table):
- `enrichmentStatus`: `pending | queued | in_progress | enriched | failed | skipped_limit`
- `enrichmentAttemptCount`
- `enrichmentQueuedAt`, `enrichmentStartedAt`, `enrichmentCompletedAt`
- `enrichmentErrorCode`, `enrichmentErrorMessage` (nullable)
- `enrichmentSource` (`manual` | `list_add_auto`)

Rationale:
- Same creator can exist in multiple lists; status must be **list-context aware**.
- Keeps board/list UI deterministic for operational states.

## 3.3 Read model/API
Extend list detail API payload (`GET /api/lists/:id`) so each item includes enrichment status fields. Add an optional lightweight endpoint for progress summaries:
- `GET /api/lists/:id/enrichment-status`
  - totals by status
  - recent failures
  - last updated timestamp

UI can poll every 3–5s while there are pending/in_progress items.

---

## 4) UI/UX design plan

## 4.1 Immediately after “Save to list”
In add-to-list overlay/toast:
- Keep current success message (“Added X creators…”).
- Add follow-up microcopy:
  - “Auto-enrichment started for X creator(s).”
  - If limits hit: “Y queued, Z pending plan limit.”

Do **not** block the user until enrichment finishes.

## 4.2 Lists page (overview)
For each list card/row show enrichment progress pill when active:
- `Enrichment: 14/50` + tiny progress bar.
- States:
  - `Idle` (no pending)
  - `Enriching` (queued/in_progress)
  - `Needs attention` (failed > 0)

## 4.3 List detail — board and list view
Introduce a visible per-creator enrichment badge on each card/row:
- `Queued` (clock icon)
- `Enriching` (spinner)
- `Enriched` (check)
- `Failed` (warning + retry CTA)

Optional global strip above board/list:
- “Auto-enrichment in progress: 23/80 completed”
- CTA: `Retry failed (3)`

## 4.4 “List spinner” (interpreting your “list spanner” ask)
Design recommendation:
- Use a **persistent, low-height progress strip** pinned under list header while active.
- Include:
  - progress bar
  - completed/total count
  - ETA hint (“~2 min remaining”) if calculable
  - non-blocking “Hide” affordance

Avoid full-page blocking spinners; enrichment is background work.

## 4.5 Result surfacing
As enrichment lands:
- Update card/row emails/metadata inline.
- Mark newly found emails with “new” badge for one session.
- Keep board interactions (drag/pin) fully functional during enrichment.

---

## 5) Edge cases and policy decisions

1. Duplicate add to same list
- If creator already exists in list, do not enqueue new job.

2. Creator in multiple lists
- Reuse cached creator enrichment data when fresh; still mark that list item as `enriched`.

3. Plan limits
- Mark affected items `skipped_limit`; provide upsell/upgrade CTA from status strip.

4. External API failure
- Mark `failed` with reason.
- Auto-retry with capped exponential backoff (e.g., 3 attempts).

5. Navigation away / reload
- State is server-driven, so polling/resume works naturally.

6. Manual enrich action coexistence
- Manual action should remain available for force-refresh.
- Manual action updates same status model with source `manual`.

---

## 6) Rollout plan (phased)

### Phase 1 — Backend foundations
- Add enrichment-status columns/table.
- On list item insert, enqueue jobs for newly inserted creators.
- Worker updates item status + logs.

### Phase 2 — Read + UI visibility
- Include enrichment status in list detail payload.
- Add per-item badges and top progress strip.
- Add overview progress pill on `/lists` page.

### Phase 3 — Reliability + controls
- Retry failed action.
- Partial failure handling + better copy.
- Metrics dashboards and alerts.

### Phase 4 — Optimizations
- WebSocket/SSE for near-real-time updates (optional later).
- Smarter batching by platform and cache freshness.

---

## 7) Telemetry / success metrics

Track at minimum:
- `list_add_auto_enrichment_enqueued`
- `list_add_auto_enrichment_started`
- `list_add_auto_enrichment_succeeded`
- `list_add_auto_enrichment_failed`
- time-to-first-enriched and time-to-all-enriched per list
- % creators enriched within 2/5/10 minutes
- user engagement after enrichment (open rate, export, outreach action)

Success criteria (example):
- p50 list add response unchanged (fast)
- >90% auto-enrichment success within 5 minutes
- measurable lift in outreach actions from enriched lists

---

## 8) Implementation checklist (engineering-ready)

- [ ] Schema migration for list-item enrichment status fields.
- [ ] Update `addCreatorsToList` result contract to include inserted creator IDs for enqueueing.
- [ ] Add enqueue call in `POST /api/lists/:id/items` (fire-and-forget, resilient).
- [ ] Worker job + idempotency guard.
- [ ] Status updater and retry scheduler.
- [ ] Extend list detail serializer with enrichment fields.
- [ ] UI: per-item status badges in board/list components.
- [ ] UI: list-level progress strip + retry failed.
- [ ] UI: list overview progress pill.
- [ ] Analytics + Sentry instrumentation.
- [ ] QA: limits, failures, reload, duplicates, high-volume adds.

---



## 9) How to test and prove it works (practical validation plan)

This section defines **how we know the feature is actually working**, not just implemented.

### 9.1 Backend/API validation

1. Add creators to list (`POST /api/lists/:id/items`)
- Expect fast response (`201`) with `added/skipped/attempted`.
- Verify response latency does not regress materially vs baseline.

2. Queue dispatch verification
- For each newly added creator, verify one enqueue event with idempotency key `${listId}:${creatorProfileId}`.
- Re-adding same creator to same list must not enqueue duplicate jobs.

3. Worker lifecycle verification
- Status transition order should be:
  - `queued -> in_progress -> enriched` OR
  - `queued -> in_progress -> failed` OR
  - `queued -> skipped_limit`
- Ensure timestamps are filled at each transition.

4. Read model correctness
- `GET /api/lists/:id` returns item-level enrichment status fields.
- `GET /api/lists/:id/enrichment-status` returns aggregate totals that match item rows.

### 9.2 UI validation (manual + E2E)

1. Save flow
- Save 5 creators to a list.
- Verify immediate success toast appears before enrichment completes.
- Verify follow-up “Auto-enrichment started...” message appears.

2. List detail live status
- Open list detail immediately after save.
- Verify per-item badges show mixed states (`Queued`, `Enriching`, `Enriched`, `Failed`).
- Verify top progress strip updates every poll tick.

3. Failure and retry
- Simulate API failure for one creator.
- Verify `Failed` badge and `Retry failed (N)` action.
- After retry, verify status updates to `Enriched` or remains `Failed` with incremented attempts.

4. Limit handling
- Simulate plan limit hit.
- Verify affected creators render as `Limit reached`/`skipped_limit` and upgrade CTA appears.

5. Non-blocking UX
- While enrichment runs, drag-drop, pin/unpin, and bucket changes must still work.

### 9.3 Acceptance criteria (ship gate)

- Add-to-list p50 latency remains within agreed threshold.
- >=90% creators reach `enriched` or deterministic terminal state within 5 minutes.
- UI never blocks list interactions during enrichment.
- Aggregate counts match per-item truth at all times.

---

## 10) ASCII UI spec (for visual comparison)

### 10.1 Add-to-list success + enrichment start

```text
┌──────────────────────────────────────────────────────────┐
│ ✅ Added 5 creators to “Q1 Outreach”                    │
│ ✨ Auto-enrichment started for 5 creators               │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Lists overview card state

```text
┌──────────────────────────────────────────────────────────┐
│ Q1 Outreach                           50 creators        │
│ Enrichment: 14/50  [██████░░░░░░░░░░] 28%               │
│ Status: ENRICHING                                         │
└──────────────────────────────────────────────────────────┘
```

Failed-state variant:

```text
┌──────────────────────────────────────────────────────────┐
│ Q1 Outreach                           50 creators        │
│ Enrichment: 45/50  [███████████████░] 90%               │
│ Status: NEEDS ATTENTION (5 failed)                      │
└──────────────────────────────────────────────────────────┘
```

### 10.3 List detail header progress strip (“list spinner/spanner”)

```text
List: Q1 Outreach
┌────────────────────────────────────────────────────────────────────────────┐
│ Auto-enrichment in progress: 23/80 completed   ETA ~2m    [Hide] [Retry 3]│
│ [███████████░░░░░░░░░░░░░░░░░░░░░░░░] 29%                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 List detail table row states

```text
| Creator        | Email                 | Bucket    | Enrichment Status        |
|----------------|-----------------------|-----------|--------------------------|
| @alicefit      | —                     | backlog   | ⏳ Queued                |
| @bobbakes      | —                     | contacted | 🔄 Enriching...          |
| @cara.travel   | cara@site.com (new)   | backlog   | ✅ Enriched (1m ago)     |
| @danstudio     | —                     | backlog   | ⚠ Failed  [Retry]       |
| @evamusic      | —                     | backlog   | 🔒 Limit reached [Upgrade]|
```

### 10.5 Board card state chips

```text
┌─────────────────────────────┐
│ @cara.travel                │
│ cara@site.com   [new]       │
│ [✅ Enriched]               │
└─────────────────────────────┘

┌─────────────────────────────┐
│ @danstudio                  │
│ no email                    │
│ [⚠ Failed] [Retry]         │
└─────────────────────────────┘
```

---

## 11) Final UX principle

Treat auto-enrichment as an **asynchronous enhancement pipeline**, not a blocking save step:
- Save first (instant confidence).
- Enrich in background (visible progress).
- Merge insights live (clear outcome).
