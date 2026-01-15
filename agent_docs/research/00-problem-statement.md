

I am a **solo founder** building Gemz (usegems.io) — an influencer discovery platform. You're ( Claude ) the entire engineering team, product team, and operations rolled into one person.

I have a Claude Max subscription ($100/mo) which gives you access to:
- Claude.ai (Web)
- Claude Desktop App
- Claude iOS App
- Claude Code (CLI)
- Claude Code on Web
- Claude Code in Slack
- Claude Agent SDK
- MCP integrations

Your hardware ecosystem:
- **Mac** — Primary development machine
- **iPhone** — Always with you, currently underutilized for shipping

Supporting tools:
- **GitHub** — Code, PRs, deployments (Vercel auto-deploys to staging)
- **Linear** — Task tracking (Gemz team exists)
- **Granola** — Meeting notes (handles meeting capture well)
- **Wispr Flow** — Speech-to-text (Desktop + iPhone)
- **Slack** — Client communication

---

## The Core Problem

### You're Desk-Bound

Right now, **real work only happens at your desk**. The moment you step away — commute, walk, gym, bed, random life moments — your ability to ship drops to zero. Ideas hit you constantly in these contexts, but they die in transit because there's no systematic way to capture → structure → execute them.

### The Interconnection Gap

Your tools don't talk to each other. You're the **human middleware** doing manual glue work:
- Copy context from Slack → Create Linear issue manually
- See a bug → Have to write up the issue yourself
- Think of a fix → No way to act on it from phone
- Claude finishes work → You update Linear status manually

### Context Switching Hell

You're constantly jumping between:
- Slack (client conversations)
- Linear (task tracking)
- GitHub (code, PRs)
- Claude Code (implementation)
- Claude.ai (thinking, planning)

Each switch costs cognitive load. Each switch risks losing the thread.

### The Resumption Problem (Your #1 Pain)

**The hardest part:** Continuing/resuming work across devices.

You have Claude on:
- iPhone (Claude iOS)
- Mac (Claude Desktop)
- Mac (Claude Code terminal)
- Browser (Claude.ai, claude.ai/code)

But there's no seamless handoff. Starting something on phone, continuing on laptop, picking up where you left off — it's all manual context rebuilding.

---

## What You Actually Want

### Work Like a High-Functioning Team

In a well-run team:
1. **Someone has a rough idea** (founder, PM, anyone)
2. **A PM structures it** into a proper task (PRD, spec, clear requirements)
3. **Engineer receives structured task** and implements it
4. **PR created, reviewed, shipped**

You want Claude to be your **PM + Engineering Team**:
- **Claude (PM role):** Takes your rough thoughts → structures them into proper tasks
- **Claude Code (Engineer role):** Takes structured tasks → implements → ships

### The Critical Bottleneck

The automation can handle everything **after** the task is properly structured.

The bottleneck is: **Rough thought → Structured task**

You need:
```
Rough voice/text idea
    ↓
Claude understands and structures it (PM work)
    ↓
Becomes a proper PRD / Linear issue / GitHub issue
    ↓
Claude Code picks it up and implements (Engineering work)
    ↓
PR ready for your review
    ↓
You review, merge
    ↓
Deployed to staging (shipped)
```

### Your Definition of "Shipped"

- **Deployed to staging** = shipped
- Quick test on main → production
- Loop complete when it's live

### Your Trust Level

- **Review before merge** — You want to see the PR before it goes in
- Not asking for full autono — asking for everything up to the review point to be automated

---

## The Ideal State

### One Entry Point

A single, frictionless way to capture thoughts:
- Voice (Wispr Flow)
- Text (phone, desktop)
- Slack message
- Meeting action item (Granola)

All funneling into the same system.

### Automatic Structuring

Your rough input gets transformed:
```
You: "The export is slow, users complaining, probably the CSV generation,
     maybe we need to stream it or do it in background"

System creates:
─────────────────────────────────────────────────────
GEM-47: Performance - CSV export timeout on large datasets

## Problem
Users experiencing slow/timeout on CSV exports for large creator lists.

## Likely Cause
Synchronous CSV generation blocking response.

## Proposed Solution
- Implement background job processing (QStash)
- Stream CSV generation
- Add progress indicator

## Acceptance Criteria
- [ ] Export 10k creators without timeout
- [ ] User sees progress/status
- [ ] Download link sent when ready
─────────────────────────────────────────────────────
```

### Automatic Execution

Once structured task exists:
1. Claude Code picks it up
2. Implements the solution
3. Creates PR with proper description
4. Links back to Linear issue
5. Notifies you: "PR ready for review"

### Seamless Device Continuity

- Start brainstorming on phone (Claude iOS)
- Structure the task with Claude
- Task goes to Linear
- Claude Code implements (runs on web, async)
- Review PR on phone (GitHub mobile)
- Merge from phone
- Shipped.

Or:

- Capture voice note while walking
- By the time you're at desk, PR is waiting
- Review, merge, done

### Parallel Execution

Multiple streams running simultaneously:
```
Stream 1: Bug fix (PR pending review)
Stream 2: Feature implementation (Claude working)
Stream 3: Task being structured (brainstorm phase)
Stream 4: New idea captured (queue)
```

All without your active attention.

---

## What Success Looks Like

### The Morning Scenario

You wake up. Check phone.

Notifications:
- "GEM-47: PR ready for review" (idea you captured yesterday while walking)
- "GEM-48: PR ready for review" (bug client mentioned in Slack)
- "GEM-49: Needs clarification" (Claude asked a question)

You review both PRs in bed. Approve. Merged. Deployed.

Two features shipped before getting out of bed.

### The Commute Scenario

Walking to coffee shop. Idea hits.

Voice: "We should add a filter for creators with email addresses only, like a toggle in the results view"

By the time coffee arrives:
- Linear issue exists with proper spec
- Claude Code is implementing
- You can check progress on phone

### The Client Call Scenario

Client: "The keyword suggestions aren't relevant enough"

After call, Granola summary appears. You react with 🎫 or say "@Linear create issue."

Issue created with meeting context. Claude picks it up. You don't think about it again until PR is ready.

### The Late Night Scenario

Can't sleep. Brain is solving problems.

Voice capture your thoughts. Go to sleep.

Wake up to PRs.

---

## The System Requirements

### 1. Unified Entry Point
- Voice (Wispr) → System
- Text (any device) → System
- Slack trigger → System
- Granola action item → System

### 2. Structuring Layer (Claude as PM)
- Takes rough input
- Asks clarifying questions if needed
- Produces structured task (PRD quality)
- Human confirms: "Yes, build this"

### 3. Execution Layer (Claude Code as Engineer)
- Receives structured task
- Implements autonomously
- Creates PR
- Links everything together

### 4. Review Layer (You)
- Get notified when PR ready
- Review on any device
- Approve → Auto-merge → Auto-deploy

### 5. Feedback Loop
- If PR needs changes, comment
- Claude iterates
- New PR ready

---

## What This Is NOT About

- ❌ Full autono (you want review before merge)
- ❌ Replacing thinking (you want to ideate, Claude structures)
- ❌ Complex project management (you're solo, keep it simple)
- ❌ Enterprise workflow (this is founder-scale, not team-scale)

---

## The Question to Answer

Given everything in Claude Max subscription and the supporting tools (Linear, GitHub, Granola, Wispr):

**How do we build a system where:**
1. Ideas captured anywhere → automatically structured into proper tasks
2. Structured tasks → automatically implemented by Claude Code
3. PRs ready for review → reviewable from any device
4. You stay in flow, Claude handles the glue work

---

## Success Metrics

- **Ideas captured → PRs created:** < 24 hours without manual intervention
- **Device switches:** Zero context loss
- **Manual glue work:** Near zero (no copy-paste between tools)
- **Shipping velocity:** 2-3x current output
- **Location independence:** Ship from anywhere with phone + internet

---

## Next Step

Design the specific integration architecture using:
- Claude iOS / Desktop / Web / Code
- Claude Code in Slack
- Claude Agent SDK
- MCP (Linear, GitHub, Obsidian)
- GitHub Actions
- Linear workflows

The pieces exist. We need to connect them into YOUR system.
