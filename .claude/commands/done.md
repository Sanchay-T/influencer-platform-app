The current task is complete. Archive it and extract a template.

## Your Job

1. **Read current task** from `agent_docs/current-task.md` and `agent_docs/tasks.md`

2. **Verify completion**:
   - All checklist items checked?
   - Tests passing?
   - Code committed?

   If not complete, tell user what's left.

3. **Create archive entry** at `agent_docs/archive/TASK-XXX-[short-name].md`:
   ```markdown
   # TASK-XXX: [Title]

   **Status:** ✅ COMPLETED
   **Duration:** [start date] → [end date]
   **Branch:** [branch name]

   ## What Was Done
   [Summary of the work]

   ## Files Changed
   [List key files]

   ## Learnings
   - What worked well
   - What was tricky
   - What to do differently next time

   ## Reusable Patterns
   [Any code patterns, approaches worth reusing]
   ```

4. **Extract template** (if this is a new type of task):

   Ask: "Should I create a template from this for future similar work?"

   If yes, create `agent_docs/templates/[type].md`:
   ```markdown
   # Template: [Type of Task]

   > Use this when: [when to use this template]

   ## Typical Checklist
   - [ ] Step 1
   - [ ] Step 2

   ## Common Files
   | Purpose | Typical Location |
   |---------|------------------|

   ## Patterns Used
   [Code patterns, architectural decisions]

   ## Pitfalls to Avoid
   [Things that caused issues]

   ## Reference Implementation
   See: archive/TASK-XXX-[name].md
   ```

5. **Update tasks.md**:
   - Move completed task to "Completed" section
   - Promote next item from Backlog to Current (or clear if none)

6. **Clear current-task.md** or populate with next task

7. **Commit**:
   ```bash
   git add agent_docs/ && git commit -m "docs: archive TASK-XXX, extract template"
   ```
