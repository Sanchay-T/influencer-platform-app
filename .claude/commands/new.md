A user has requested new work. Generate a complete task entry.

**User Request:** $ARGUMENTS

## Your Job

1. **Understand the request** — What are they really asking for?

2. **Check templates** — Read `agent_docs/templates/` for similar past work:
   ```bash
   ls agent_docs/templates/
   ```
   If a relevant template exists, use it as a starting point.

3. **Generate PRD** in `agent_docs/current-task.md`:
   ```markdown
   # [Task Title]

   **ID:** TASK-XXX (increment from tasks.md)
   **Status:** 🟡 IN_PROGRESS
   **Created:** [today's date]
   **Branch:** [suggest branch name]

   ## Goal
   [One sentence: what success looks like]

   ## Background
   [Why this is needed, context]

   ## Requirements
   - [ ] Requirement 1
   - [ ] Requirement 2

   ## Technical Approach
   [How to implement — files to change, patterns to use]

   ## Checklist
   - [ ] Step 1
   - [ ] Step 2
   - [ ] Step 3
   - [ ] Test
   - [ ] Cleanup

   ## Files to Touch
   | File | Change |
   |------|--------|

   ## References
   - Related template: [if any]
   - Similar past task: [if any]
   ```

4. **Update tasks.md** — Add the new task as current, move old to backlog if needed

5. **Create branch** (ask user first):
   ```bash
   git checkout -b feat/[short-name]
   ```

6. **Show summary** — Tell user what you created and ask if ready to start
