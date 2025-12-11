# Template: Worker/Queue System

> **Use when:** Building async processing with QStash, background jobs, fan-out patterns

## Architecture Pattern

```
API Route (dispatch)
     ↓
QStash publishes messages
     ↓
Worker routes receive messages
     ↓
Process + save results
     ↓
Status endpoint for polling
```

## Checklist Template

```markdown
- [ ] Design
  - [ ] Define message types (workers/types.ts)
  - [ ] Define job states (pending → processing → completed)
  - [ ] Plan worker responsibilities

- [ ] Database
  - [ ] Add job tracking columns if needed
  - [ ] Add progress counters

- [ ] Dispatch
  - [ ] Create /api/[version]/dispatch route
  - [ ] Validate input
  - [ ] Create job in DB
  - [ ] Publish to QStash

- [ ] Workers
  - [ ] Create /api/[version]/worker/[name] routes
  - [ ] Handle QStash verification
  - [ ] Process message
  - [ ] Update job progress
  - [ ] Handle errors gracefully

- [ ] Status
  - [ ] Create /api/[version]/status route
  - [ ] Return progress + results
  - [ ] Support pagination

- [ ] Test
  - [ ] Create test script in scripts/
  - [ ] Test happy path
  - [ ] Test error cases
  - [ ] Test concurrent jobs
```

## Key Files Pattern

```
lib/[feature]/
├── core/
│   ├── types.ts           # Shared types
│   ├── config.ts          # Constants, URLs
│   └── job-tracker.ts     # DB updates
├── workers/
│   ├── types.ts           # Message types
│   ├── dispatch.ts        # Fan-out logic
│   └── [worker-name].ts   # Worker logic
└── adapters/              # External API adapters
    └── [adapter].ts

app/api/[version]/
├── dispatch/route.ts
├── worker/
│   └── [name]/route.ts
└── status/route.ts
```

## QStash Patterns

```typescript
// Publishing
import { qstash } from '@/lib/queue/qstash';

await qstash.publishJSON({
  url: `${baseUrl}/api/v2/worker/search`,
  body: { jobId, keyword, platform },
  retries: 3,
});

// Receiving
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

export const POST = verifySignatureAppRouter(async (req) => {
  const body = await req.json();
  // process...
});
```

## Reference Implementation

- V2 Search System: `lib/search-engine/v2/`
- Architecture doc: `agent_docs/v2-fan-out-architecture.md`
