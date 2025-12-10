# UseGems.io (Gemz)

You're working on an influencer discovery platform for businesses to find, organize, and export creators across TikTok, Instagram, and YouTube.

**Deployment**: Vercel → usegems.io

## Session Continuity

**If you just started or your context was cleared:**

Your memory persists in files. Before doing anything:

1. **Read `@agent_docs/monologue.md`** — Your previous self's narrative: what was happening, why, key decisions
2. **Read `@agent_docs/current-task.md`** — Tactical next steps: exactly what to do next
3. **Check for compaction markers** — If monologue.md has "Context Compacted" entries, you're continuing interrupted work

**During your session:**

- Update `monologue.md` at key milestones (completed phases, major decisions)
- Update `current-task.md` when tasks complete
- The PreCompact hook will timestamp when context clears

**The goal:** Seamless continuity. The next agent instance should feel like it's reading a handoff note from itself.

## Tech Stack

Next.js 15 (App Router) · Clerk · Drizzle + PostgreSQL (Supabase) · Stripe · QStash · Resend · Sentry

## User Journey

### Authentication & Onboarding

Users sign up or sign in via Clerk. After authentication, new users see an onboarding modal with 4 steps:

1. **Step 1**: Enter full name and business name
2. **Step 2**: Describe their brand and influencer preferences
3. **Step 3**: Select a plan (Glow Up, Viral Surge, or Fame Flex) with monthly/yearly toggle → Click "Start Checkout" → Redirected to Stripe checkout
4. **Step 4**: Success screen showing plan benefits → Click "Continue" → Redirected to dashboard

Every plan includes a 7-day free trial.

### Main App Navigation

The sidebar has 5 main tabs:
- **Dashboard** — Overview and quick stats
- **Campaigns** — Create and manage influencer search campaigns
- **Lists** — Organize saved creators into lists
- **Account Settings** — Profile, trial status, plan info
- **Billing & Plans** — Subscription management, plan comparison, upgrade

Below the tabs: Trial status component with upgrade option.

### Campaigns (Core Feature)

Campaigns are containers for influencer searches. To search for creators, users must first create a campaign.

**Campaign List View:**
- Create new campaign button
- Filter/sort by: All, Draft, Active, Completed, Newest
- Each campaign card shows: View, Similar search, Keyword search options

**Inside a Campaign:**
- Header: Campaign name, last search type, total runs, creation date
- Top right actions: Keyword Search, Similar Search, Export CSV
- Left sidebar: List of runs (Run #1, Run #2, etc.), New Search button

### Search Types

**Keyword Search:**
1. Select platform: TikTok, Instagram, or YouTube
2. Select creator count: Slider from 100 to 1000
3. Click Continue
4. Add keywords (AI suggestions appear as you type)
5. Run the search

**Similar Creator Search:**
- Available for: Instagram, YouTube (TikTok is work-in-progress)
- Enter a creator's username
- Click "Find Similar Creators"
- System finds creators in the same niche

### Search Results

Each run shows two tabs:
- **Creators tab**: All discovered creators with their posts
- **Activity tab**: Search activity and metadata

**View Options:**
- Table view or Gallery view
- Email-only filter (shows only creators with email addresses)

**Actions:**
- Save individual creators to a list
- Bulk select via checkboxes → Save all to a list
- Create new list directly from the save dropdown

### Lists

Lists help organize creators for outreach and campaign management.

**Creating a List:**
- Enter list name
- Select list type (Campaign, Favorites, Industry, Research, Contacted, Custom)
- Add description
- Click Create

**Inside a List:**
- Header: List details, Export CSV button, Delete button
- **Board View**: Kanban-style with columns (Backlog, Shortlist, Contacted, Booked/Contract) — drag creators between stages
- **List View**: Traditional table format

### Account & Billing

**Account Settings:**
- Trial status: Days/hours remaining, start and expiry dates
- Personal information
- Current plan and status

**Billing & Plans:**
- Current subscription status
- Quick actions
- Plan comparison (all 3 plans with features)
- Upgrade options

### Plans

| Plan | Price | Campaigns | Creators/month |
|------|-------|-----------|----------------|
| Glow Up | $99/mo | 3 | 1,000 |
| Viral Surge | $249/mo | 10 | 10,000 |
| Fame Flex | $499/mo | Unlimited | Unlimited |

## Commands

**Dev server:** `npm run dev:ngrok` (port 3001, ngrok domain: `usegemz.ngrok.app`)

Before starting, check if the server is already running. If yes, proceed. If no, start it in the background.

```bash
npm run db:studio        # Open Drizzle Studio
npm run db:push          # Generate + run migrations (interactive)
npm run lint:biome       # Run Biome linter
npm run lint:biome:fix   # Auto-fix Biome issues
```

**Database operations:** Schema changes require human interaction for migration prompts. See @agent_docs/database.md for the full workflow.

## Folder Structure

```
app/                     # Next.js App Router pages and API routes
├── api/                 # API route handlers
├── components/          # Page-specific components
├── dashboard/           # Dashboard page
├── campaigns/           # Campaigns pages
├── lists/               # Lists pages
├── onboarding/          # Onboarding flow pages
├── billing/             # Billing page
lib/                     # Core business logic
├── auth/                # Clerk integration helpers
├── db/                  # Drizzle schema and queries
├── onboarding/          # Onboarding state machine
├── search-engine/       # Creator search providers
├── services/            # Billing, plans, feature gates
├── stripe/              # Stripe client and service
├── logging/             # Structured logging
components/ui/           # Shared UI components (shadcn)
scripts/                 # Utility and maintenance scripts
```

## Tool Usage

### Searching the Codebase

**Use semantic search when:**
- You don't know exact file/function names
- You're exploring feature flows
- You're understanding connections between modules

**Use regular grep when:**
- You need an exact string match
- You know the pattern or symbol name
- You're counting occurrences

### Editing Files

**Prefer fast-apply tools** for file modifications. Use `// ... existing code ...` markers for unchanged sections.

**Fall back to Edit tool** when fast-apply fails or you need `replace_all` for bulk renaming.

## Critical Rules

### Standard Practices

- Use Server Components by default; only add `'use client'` when you need interactivity
- Never use `any`; use Drizzle's inferred types for DB entities
- Validate inputs, return `{ error: string }`, use proper HTTP status codes
- Use transactions for multi-table ops; always include `userId` in queries
- Use `lib/logging/` for structured logging — never use `console.log`

### Linting (Biome)

After you edit files, run: `npx biome check --write <files-you-edited>`

⚠️ **Do NOT run on the entire codebase** — there are 2000+ legacy issues.

See @agent_docs/code-patterns.md for patterns and common fixes.

### Testing & Verification

You can test API endpoints without Clerk auth using the test auth system. Use prompts like:
- "Test TikTok keyword search for 'fitness influencer'"
- "Verify campaign creation after my fix"
- "Debug why Instagram search returns 403"

**Before claiming done:** Lint → Type check → Test the feature → Tell the user how to verify in UI.

(Context updates happen automatically with each commit — see Git Workflow below.)

See @agent_docs/testing-verification.md for the full testing workflow.

### Code Quality

- Check existing patterns in `lib/` before creating new abstractions
- **No file should exceed 300 lines** — split into focused modules (components → extract sub-components, API routes → extract to `lib/services/`)

### Git Workflow + Context Management

**At session start:** Read `@agent_docs/current-task.md` to know where you left off.

**Before starting new work**, create a feature branch:
```bash
git checkout -b fix/short-description   # or feat/, refactor/
```

**After each logical change** — update context, then commit:
1. Update `current-task.md` with what you just did
2. Commit and push everything together:
```bash
git add -A && git commit -m "fix: description" && git push origin HEAD
```

This keeps code AND context backed up. You can't commit without updating your memory.

**Before merging to main** (task complete):
1. Append full entry to `session-history/YYYY-MM.md`
2. User tests
3. Merge:
```bash
git checkout main && git merge <branch> && git push origin main
```

Commit prefixes: `fix:`, `feat:`, `refactor:`, `chore:`

**Session history entry format:**
```
## Mon DD, YYYY — HH:MM AM/PM
**Task:** What you worked on
**Branch:** branch-name  
**Status:** Done / Waiting for user / In progress
**What you did:** Bullet points
**Decisions:** Key choices made
**Next:** What comes next
```

## Key References

**Your memory (read first):**
- @agent_docs/current-task.md — What you're working on NOW (update every commit)
- @agent_docs/session-history/YYYY-MM.md — What you did BEFORE (append before merge)

**Domain docs (read when relevant):**
- @agent_docs/architecture.md — System overview, domain boundaries
- @agent_docs/v2-fan-out-architecture.md — V2 search system (fan-out workers, QStash)
- @agent_docs/onboarding-flow.md — 4-step onboarding, Stripe checkout
- @agent_docs/billing-stripe.md — Plans, trials, webhooks
- @agent_docs/search-engine.md — Keyword/Similar search providers (LEGACY - being replaced by v2)
- @agent_docs/campaigns-lists.md — Campaign CRUD, List management
- @agent_docs/database.md — Drizzle schema, query patterns
- @agent_docs/api-patterns.md — Route conventions, auth guards
- @agent_docs/testing-verification.md — Testing workflow, verification checklist
- @agent_docs/code-patterns.md — Common code patterns and fixes
