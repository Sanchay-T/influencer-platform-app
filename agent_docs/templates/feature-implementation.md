# Template: Feature Implementation

> **Use when:** Building a new feature end-to-end (backend + frontend)

## Typical Phases

1. **Design** — Understand requirements, check existing patterns
2. **Schema** — Database changes if needed
3. **Backend** — API routes, services, workers
4. **Frontend** — UI components, state, API integration
5. **Test** — E2E testing, edge cases
6. **Cleanup** — Remove old code, update docs

## Checklist Template

```markdown
- [ ] Phase 1: Design
  - [ ] Write requirements in current-task.md
  - [ ] Check templates/ for similar work
  - [ ] Identify files to change

- [ ] Phase 2: Schema (if needed)
  - [ ] Update lib/db/schema.ts
  - [ ] Run migration
  - [ ] Verify in Drizzle Studio

- [ ] Phase 3: Backend
  - [ ] Create/update API routes
  - [ ] Add validation
  - [ ] Add error handling
  - [ ] Test with scripts/

- [ ] Phase 4: Frontend
  - [ ] Update UI components
  - [ ] Wire up API calls
  - [ ] Handle loading/error states
  - [ ] Test in browser

- [ ] Phase 5: Test
  - [ ] Run existing tests
  - [ ] Manual E2E test
  - [ ] Edge cases

- [ ] Phase 6: Cleanup
  - [ ] Remove dead code
  - [ ] Run linter
  - [ ] Update docs if needed
```

## Common Patterns

### API Route Structure
```typescript
// app/api/[feature]/route.ts
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';

export async function POST(req: Request) {
  const auth = await getAuthOrTest(req);
  if (!auth?.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... implementation
}
```

### Service Layer
```typescript
// lib/services/[feature].ts
// Keep business logic here, not in routes
```

## Pitfalls

- Don't skip validation
- Don't forget error handling
- Keep files under 300 lines
- Test before claiming done

## Reference

- See: `archive/` for past implementations
