# Claude Code Power User Guide

> **Goal:** Master every feature, shortcut, and workflow to become a Claude Code power user.
> Each section has exercises you should try at least once.

---

## Table of Contents

1. [Keyboard Shortcuts Mastery](#1-keyboard-shortcuts-mastery)
2. [Vim Mode Complete Guide](#2-vim-mode-complete-guide)
3. [Image & Media Features](#3-image--media-features)
4. [File References & @ Mentions](#4-file-references---mentions)
5. [Yank/Kill Ring (Clipboard History)](#5-yankkill-ring-clipboard-history)
6. [History Search (Ctrl+R)](#6-history-search-ctrlr)
7. [Session Management](#7-session-management)
8. [Thinking Mode & Plan Mode](#8-thinking-mode--plan-mode)
9. [Background Commands](#9-background-commands)
10. [Model Switching](#10-model-switching)
11. [Theme & Syntax Highlighting](#11-theme--syntax-highlighting)
12. [Terminal Setup](#12-terminal-setup)
13. [Context & Stats Commands](#13-context--stats-commands)
14. [Custom Slash Commands](#14-custom-slash-commands)
15. [Prompt Suggestions](#15-prompt-suggestions)
16. [LSP (Language Server Protocol)](#16-lsp-language-server-protocol)
17. [Claude in Chrome (Browser Automation)](#17-claude-in-chrome-browser-automation)
18. [MCP Servers](#18-mcp-servers)
19. [Plugins System](#19-plugins-system)
20. [Hooks System](#20-hooks-system)
21. [Custom Agents & Skills](#21-custom-agents--skills)
22. [Memory System (CLAUDE.md)](#22-memory-system-claudemd)
23. [Permission System](#23-permission-system)
24. [Quick Reference Card](#24-quick-reference-card)

---

## 1. Keyboard Shortcuts Mastery

### Essential Navigation

| Shortcut | Action | When to Use |
|----------|--------|-------------|
| `Ctrl+C` | Cancel/interrupt | Stop Claude mid-response |
| `Ctrl+L` | Clear screen | Clean up terminal (keeps history) |
| `Ctrl+D` | Exit session | End Claude Code |
| `Esc` | Cancel input / Exit mode | Cancel current action |
| `Esc Esc` | Rewind conversation | Undo code changes |

### Input Editing (Readline-style)

| Shortcut | Action |
|----------|--------|
| `Ctrl+A` | Move to start of line |
| `Ctrl+E` | Move to end of line |
| `Ctrl+W` | Delete word backward |
| `Ctrl+K` | Delete to end of line (kill) |
| `Ctrl+U` | Delete entire line |
| `Ctrl+Y` | Paste killed text (yank) |
| `Alt+Y` | Cycle through kill ring (after Ctrl+Y) |
| `Ctrl+_` | Undo last edit |

### Mode Switching

| Shortcut | Action |
|----------|--------|
| `Shift+Tab` | Cycle: Normal → Auto-Accept → Plan Mode |
| `Alt+M` (Windows) | Same as Shift+Tab |
| `Alt+T` | Toggle thinking mode |
| `Alt+P` / `Option+P` | Switch model while typing |
| `Ctrl+O` | Toggle verbose transcript |

### Multiline Input

| Method | Shortcut |
|--------|----------|
| Backslash escape | `\` then `Enter` |
| Option+Enter (macOS) | Works by default |
| Shift+Enter | After `/terminal-setup` |
| Ctrl+J | Line feed character |

### Special Features

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | History search |
| `Ctrl+B` | Background current bash command |
| `Ctrl+G` | Edit prompt in external editor |
| `Ctrl+S` (in /stats) | Screenshot stats to clipboard |
| `Tab` | Autocomplete file paths |

---

### Exercise 1.1: Essential Shortcuts Practice

```
Try each of these RIGHT NOW:

1. Type a long message, then press Ctrl+A → Ctrl+K → Ctrl+Y
   (move to start, kill line, paste it back)

2. Type "hello world", press Ctrl+W twice
   (deletes word by word)

3. Press Shift+Tab 3 times and watch the mode indicator change
   (cycles through permission modes)

4. Press Ctrl+L to clear your screen

5. Type something, then press Ctrl+_ to undo

6. Press Alt+T to toggle thinking mode (notice the indicator)

7. Press Ctrl+R and type "git" to search history
```

### Exercise 1.2: Kill Ring Practice

```
The kill ring remembers your last deleted text:

1. Type: "first delete this"
2. Press Ctrl+K to kill "first delete this"
3. Type: "second delete this"
4. Press Ctrl+K to kill "second delete this"
5. Press Ctrl+Y → pastes "second delete this"
6. Press Alt+Y → replaces with "first delete this"
7. Press Alt+Y again → cycles back to "second delete this"
```

---

## 2. Vim Mode Complete Guide

### Enabling Vim Mode

```bash
/vim              # Toggle for current session
/config           # Set as permanent default
```

### Mode Switching

| From INSERT | Command | Result |
|-------------|---------|--------|
| INSERT | `Esc` | → NORMAL mode |

| From NORMAL | Command | Result |
|-------------|---------|--------|
| NORMAL | `i` | Insert before cursor |
| NORMAL | `I` | Insert at line start |
| NORMAL | `a` | Insert after cursor |
| NORMAL | `A` | Insert at line end |
| NORMAL | `o` | Open line below |
| NORMAL | `O` | Open line above |

### Navigation (NORMAL mode)

| Command | Action |
|---------|--------|
| `h` `j` `k` `l` | Left, Down, Up, Right |
| `w` | Next word start |
| `e` | Next word end |
| `b` | Previous word start |
| `0` | Line start |
| `$` | Line end |
| `^` | First non-blank character |
| `gg` | Start of input |
| `G` | End of input |

### Editing (NORMAL mode)

| Command | Action |
|---------|--------|
| `x` | Delete character under cursor |
| `dd` | Delete entire line |
| `D` | Delete to end of line |
| `dw` | Delete word |
| `db` | Delete word backward |
| `cc` | Change entire line |
| `C` | Change to end of line |
| `cw` | Change word |
| `.` | Repeat last change |
| `u` | Undo |

### Find Characters (NORMAL mode)

| Command | Action |
|---------|--------|
| `f{char}` | Find char forward on line |
| `F{char}` | Find char backward on line |
| `t{char}` | Till (before) char forward |
| `T{char}` | Till char backward |
| `;` | Repeat last f/F/t/T |
| `,` | Repeat last f/F/t/T backward |

---

### Exercise 2.1: Basic Vim Navigation

```
Enable vim mode first: /vim

1. Type this text: "The quick brown fox jumps over the lazy dog"
2. Press Esc to enter NORMAL mode
3. Press 0 to go to line start
4. Press w w w to move 3 words forward (should be on "fox")
5. Press $ to go to line end
6. Press b b to go back 2 words
7. Press ^ to go to first non-blank
```

### Exercise 2.2: Vim Editing

```
1. Type: "Hello world from Claude Code"
2. Press Esc → NORMAL mode
3. Press 0 → go to start
4. Press dw → delete "Hello"
5. Press i → INSERT mode
6. Type "Greetings" → then Esc
7. Press $ → end of line
8. Press b → back one word
9. Press cw → change word, type "CLI" → Esc
```

### Exercise 2.3: Find and Move

```
1. Type: "function calculateTotal(items, discount, tax)"
2. Press Esc → NORMAL mode
3. Press 0 → go to start
4. Press f( → find first parenthesis
5. Press ; → find next (won't move, only one)
6. Press F → move to capital C in calculate
7. Press t, → go till first comma
```

### Exercise 2.4: Repeat and Undo

```
1. Type: "one two three four five"
2. Esc → NORMAL mode
3. Press 0 → start
4. Press dw → delete "one"
5. Press . → repeat (deletes "two")
6. Press . → repeat (deletes "three")
7. Press u u u → undo 3 times
```

### Exercise 2.5: Daily Vim Workflow

```
Practice this sequence until it's muscle memory:

1. Start typing your prompt (INSERT mode by default)
2. Esc → to review/edit
3. Use w/b to navigate by word
4. Use cw to change a word
5. Press A to continue at end
6. Enter to submit

Do this 10 times with different prompts!
```

---

## 3. Image & Media Features

### Adding Images

| Method | How |
|--------|-----|
| Paste from clipboard | `Ctrl+V` (macOS/Linux) or `Alt+V` (Windows) |
| Drag and drop | Drag image file into terminal |
| File path reference | Type path: `/path/to/image.png` |
| @ mention | `@path/to/screenshot.png` |

### Clickable Image Links (v2.0.73+)

When Claude references images, they appear as `[Image #1]` links. Click them to open in your default viewer.

### What Claude Can Do With Images

- Analyze screenshots and error messages
- Extract text from images (OCR)
- Understand UI mockups and designs
- Read diagrams and flowcharts
- Compare visual differences
- Generate CSS from design images

---

### Exercise 3.1: Paste an Image

```
1. Take a screenshot of anything (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
2. Come back to Claude Code
3. Press Ctrl+V (or Alt+V on Windows)
4. You should see "[Image attached]" or similar
5. Type: "What do you see in this image?"
```

### Exercise 3.2: Drag and Drop

```
1. Find an image file on your computer
2. Drag it directly into the Claude Code terminal window
3. Ask: "Describe this image in detail"
```

### Exercise 3.3: Reference by Path

```
1. Find the path to any image on your system
2. Type: "Analyze the image at /path/to/your/image.png"
   (Claude will use the Read tool to view it)
```

### Exercise 3.4: Click Image Links

```
1. After Claude analyzes an image, look for [Image #1] in the response
2. Click it to open the image in your default viewer
3. This works for any images in the conversation
```

---

## 4. File References & @ Mentions

### @ Mention Syntax

| Pattern | What It Does |
|---------|--------------|
| `@filename.ts` | Reference file in current directory |
| `@src/utils/helpers.ts` | Reference nested file |
| `@~/file.md` | Reference file in home directory |
| `@src/components` | Reference entire directory (listing) |
| `@.` | Reference current directory |

### How It Works

1. Type `@` to trigger autocomplete
2. Start typing filename or path
3. Press `Tab` to autocomplete
4. Selected file content is added to context

### Benefits

- **Faster:** No waiting for Claude to Read the file
- **Explicit:** You control exactly what's in context
- **Searchable:** Fuzzy matching finds files fast

---

### Exercise 4.1: Basic @ Mention

```
1. Type: @pack (then Tab to autocomplete package.json)
2. Submit: "What dependencies does this project have?"
```

### Exercise 4.2: Nested Path

```
1. Type: @src/ and wait for suggestions
2. Navigate with arrow keys or keep typing
3. Select a file and ask about it
```

### Exercise 4.3: Multiple Files

```
1. Reference multiple files in one prompt:
   "@package.json and @tsconfig.json - are these configurations compatible?"
```

### Exercise 4.4: Directory Listing

```
1. Type: @src/components
2. This shows directory contents (not file contents)
3. Ask: "What components are available?"
```

---

## 5. Yank/Kill Ring (Clipboard History)

### Kill Commands (Save to Ring)

| Command | Action |
|---------|--------|
| `Ctrl+K` | Kill from cursor to end of line |
| `Ctrl+U` | Kill entire line |
| `Ctrl+W` | Kill word backward |

### Yank Commands (Paste from Ring)

| Command | Action |
|---------|--------|
| `Ctrl+Y` | Paste most recent kill |
| `Alt+Y` | After Ctrl+Y, cycle to previous kill |

### How It Works

The kill ring remembers your last several deletions. After pasting with `Ctrl+Y`, press `Alt+Y` repeatedly to cycle through older kills.

---

### Exercise 5.1: Kill Ring Cycle

```
1. Clear your input
2. Type: "FIRST" → Ctrl+K
3. Type: "SECOND" → Ctrl+K
4. Type: "THIRD" → Ctrl+K
5. Press Ctrl+Y → shows "THIRD"
6. Press Alt+Y → changes to "SECOND"
7. Press Alt+Y → changes to "FIRST"
8. Press Alt+Y → cycles back to "THIRD"
```

### Exercise 5.2: Practical Kill Ring Use

```
Scenario: You want to move parts of a long prompt around

1. Type: "First do A, then do B, finally do C"
2. Position cursor after "First do A, "
3. Ctrl+K to kill the rest
4. Now retype with different order, using Ctrl+Y to paste pieces
```

---

## 6. History Search (Ctrl+R)

### How to Use

1. Press `Ctrl+R` to start reverse search
2. Type search term (searches your command history)
3. Press `Ctrl+R` again to find older matches
4. Press `Tab` or `Esc` to accept and edit
5. Press `Enter` to accept and submit immediately
6. Press `Ctrl+C` to cancel

### Features

- Fuzzy matching works
- History is per-working-directory
- Recent commands shown first
- Search term is highlighted in results

---

### Exercise 6.1: Basic History Search

```
1. First, send a few prompts so you have history:
   - "What is TypeScript?"
   - "How do I create a React component?"
   - "Explain async/await"

2. Press Ctrl+R
3. Type "react" → should find "How do I create a React component?"
4. Press Enter to re-submit that prompt
```

### Exercise 6.2: Navigate History

```
1. Press Ctrl+R
2. Type "type"
3. Press Ctrl+R again to cycle through matches
4. Press Tab to accept and edit before submitting
```

### Exercise 6.3: Quick Recall Workflow

```
Use this pattern daily:

1. You remember you asked about "authentication" earlier
2. Ctrl+R → type "auth"
3. Found it! Tab to edit, or Enter to resubmit
```

---

## 7. Session Management

### Resume Sessions

| Command | Action |
|---------|--------|
| `claude --continue` | Resume most recent session |
| `claude --resume` | Open session picker |
| `claude --resume <name>` | Resume named session |
| `/resume` | In-session picker |
| `/resume <name>` | Resume specific session |

### Session Picker Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate sessions |
| `←` / `→` | Expand/collapse groups |
| `Enter` | Select session |
| `P` | Preview session |
| `R` | Rename session |
| `/` | Search sessions |
| `A` | Toggle all projects view |
| `B` | Filter by current branch |
| `Esc` | Exit picker |

### Naming & Renaming

```bash
/rename auth-refactor     # Name current session
```

### Forking Sessions

```bash
claude --resume abc123 --fork-session                    # Fork from CLI
claude --resume abc123 --fork-session --session-id "my-fork"  # Fork with custom name
```

---

### Exercise 7.1: Name Your Session

```
1. Start a new topic: "Let's discuss API design"
2. Immediately run: /rename api-design-discussion
3. Now this session is named and easy to find later
```

### Exercise 7.2: Use the Session Picker

```
1. Run /resume
2. Press / to search
3. Type part of a session name
4. Use arrow keys to navigate
5. Press P to preview without opening
6. Press Enter to resume, or Esc to cancel
```

### Exercise 7.3: Resume from CLI

```
1. Exit Claude Code (Ctrl+D)
2. Run: claude --continue
   (resumes your last session)

3. Exit again
4. Run: claude --resume
   (opens the picker)
```

### Exercise 7.4: Fork a Session

```
1. In a session, reach a good checkpoint
2. From CLI: claude --resume <session-id> --fork-session --session-id "experiment-1"
3. Now you have two parallel sessions from the same point
```

---

## 8. Thinking Mode & Plan Mode

### Thinking Mode

Extended thinking gives Claude more time to reason through complex problems.

| Method | How |
|--------|-----|
| Toggle shortcut | `Alt+T` |
| Config toggle | `/config` → Enable thinking mode |
| Per-request | Say "think" or "ultrathink" in your prompt |
| Env variable | `MAX_THINKING_TOKENS=1024` |

**Trigger words:** "think", "think harder", "ultrathink", "think step by step"

### Plan Mode

Read-only analysis mode - Claude cannot make changes, only plan.

| Method | How |
|--------|-----|
| Toggle shortcut | `Shift+Tab` (cycle to plan mode) |
| CLI flag | `claude --permission-mode plan` |
| Config default | Set `defaultMode: "plan"` in settings |

**Indicators:**
- `⏸ plan mode on` = Plan mode active
- `⏵⏵ accept edits on` = Auto-accept mode
- No indicator = Normal mode

---

### Exercise 8.1: Toggle Thinking Mode

```
1. Press Alt+T to enable thinking mode
2. Look for the thinking mode indicator
3. Ask: "What's the best way to structure a Node.js backend?"
4. Notice extended thinking in the response
5. Press Alt+T to disable
```

### Exercise 8.2: Trigger Thinking with Words

```
Try each of these prompts:

1. "Think about how we should refactor the authentication system"
2. "Think harder about the edge cases in this function"
3. "Ultrathink: design a scalable caching layer"

Notice how the thinking depth increases!
```

### Exercise 8.3: Plan Mode Cycle

```
1. Press Shift+Tab → watch indicator change to "plan mode"
2. Ask: "How would you add dark mode to this app?"
3. Claude will analyze but NOT make changes
4. Press Shift+Tab → cycles to "accept edits on"
5. Press Shift+Tab → back to normal mode
```

### Exercise 8.4: Plan Mode for Safe Exploration

```
1. Enter plan mode (Shift+Tab until you see "plan mode on")
2. Ask: "What files would I need to change to add a new API endpoint?"
3. Claude will give you a plan without touching any files
4. Review the plan, then exit plan mode to execute
```

---

## 9. Background Commands

### Running Commands in Background

| Method | How |
|--------|-----|
| Ctrl+B | Press while bash is running |
| Ask Claude | "Run the dev server in the background" |

**Note:** For tmux users, press `Ctrl+B` twice (first sends to tmux, second to Claude).

### Managing Background Tasks

```bash
/bashes           # List all background tasks
/tasks            # Alternative command
```

### Best Uses

- Development servers (`npm run dev`)
- Watch mode commands (`npm run watch`)
- Long builds (`npm run build`)
- Database processes
- Anything that runs continuously

---

### Exercise 9.1: Background a Dev Server

```
1. Ask Claude: "Start the dev server with npm run dev"
2. While it's running, press Ctrl+B
3. The command goes to background
4. You can keep working while it runs!
5. Run /bashes to see it listed
```

### Exercise 9.2: Background Manually

```
1. Ask Claude to run a long command (like a build)
2. As soon as it starts, press Ctrl+B
3. Claude reports it's backgrounded with a task ID
4. Check on it later with /bashes
```

---

## 10. Model Switching

### Available Models

| Model | Alias | Best For |
|-------|-------|----------|
| Claude Opus 4.5 | `opus` | Complex reasoning, architecture |
| Claude Sonnet 4.5 | `sonnet` | Balanced speed/quality (default) |
| Claude Haiku 4.5 | `haiku` | Fast tasks, quick answers |

### Switching Methods

| Method | How |
|--------|-----|
| During typing | `Alt+P` / `Option+P` |
| Slash command | `/model opus` |
| CLI flag | `claude --model opus` |
| Hybrid | `opusplan` (Opus for planning, Sonnet for execution) |

### Extended Context

Add `[1m]` suffix for 1 million token context:
```bash
/model claude-sonnet-4-5-20250929[1m]
```

---

### Exercise 10.1: Quick Model Switch

```
1. Start typing a complex question
2. Before submitting, press Alt+P (or Option+P on Mac)
3. Select a different model from the picker
4. Submit your question
```

### Exercise 10.2: Use Slash Command

```
1. Run: /model
2. Browse available models
3. Select one
4. Notice the model change in your status
```

### Exercise 10.3: Try Hybrid Mode

```
1. Run: /model opusplan
2. Now Claude uses Opus for planning, Sonnet for execution
3. Ask: "Plan how to add a new feature, then implement it"
4. Notice different models used for different phases
```

---

## 11. Theme & Syntax Highlighting

### Theme Picker (v2.0.74+)

```bash
/theme                    # Open theme picker
Ctrl+T (in /theme)        # Toggle syntax highlighting on/off
```

### What's Customizable

- Terminal color scheme (via `/theme`)
- Syntax highlighting (toggle with Ctrl+T)
- Output style (via `/output-style`)

### Available Themes

Run `/theme` to see all options. Common ones:
- Default dark
- Light mode
- ANSI (for compatibility)
- High contrast

---

### Exercise 11.1: Explore Theme Picker

```
1. Run /theme
2. Use arrow keys to navigate themes
3. Each theme previews immediately
4. Press Ctrl+T to toggle syntax highlighting
5. Press Enter to confirm, Esc to cancel
```

### Exercise 11.2: Toggle Syntax Highlighting

```
1. Run /theme
2. Press Ctrl+T
3. Notice code blocks change appearance
4. Press Ctrl+T again to toggle back
5. Find what works best for your terminal
```

---

## 12. Terminal Setup

### Supported Terminals (v2.0.74+)

- iTerm2
- macOS Terminal
- VS Code terminal
- Kitty
- Alacritty
- Zed
- Warp
- WezTerm

### Run Setup

```bash
/terminal-setup
```

This configures:
- `Shift+Enter` for multiline input
- Proper keyboard shortcuts
- Terminal-specific optimizations

### Manual Configuration

If `/terminal-setup` doesn't work for your terminal:

**For Option key as Meta (macOS Terminal):**
1. Terminal → Settings → Profiles → Keyboard
2. Check "Use Option as Meta Key"

**For iTerm2:**
1. Settings → Profiles → Keys
2. Set Left/Right Option key to "Esc+"

---

### Exercise 12.1: Run Terminal Setup

```
1. Run /terminal-setup
2. Follow the prompts for your terminal
3. Test Shift+Enter for multiline input:
   - Type "Line 1"
   - Press Shift+Enter
   - Type "Line 2"
   - Press Enter to submit both lines
```

### Exercise 12.2: Test Multiline Input

```
After /terminal-setup, try this:

1. Type: First line
2. Press Shift+Enter (should NOT submit)
3. Type: Second line
4. Press Shift+Enter
5. Type: Third line
6. Press Enter (submits all three lines)
```

---

## 13. Context & Stats Commands

### /context Command

Shows how your context window is being used:

```bash
/context
```

**Shows:**
- Visual grid of token usage
- Token distribution by type
- Skills and agents loaded (grouped by source)
- Slash commands available
- Current vs. max tokens
- When you might need to `/compact`

### /stats Command

Shows your usage analytics:

```bash
/stats
Ctrl+S (in /stats)    # Screenshot to clipboard
```

**Shows:**
- Daily usage patterns
- Streak information
- Model preferences
- Cost breakdown
- Usage trends

### /cost Command

Shows current session cost:

```bash
/cost
```

### /usage Command

Shows plan limits and usage:

```bash
/usage
```

---

### Exercise 13.1: Check Your Context

```
1. Run /context
2. Look at the colored grid
3. Note what's taking up space:
   - System prompt
   - Your messages
   - Claude's responses
   - Tool results
4. If over 60%, consider /compact
```

### Exercise 13.2: Explore Your Stats

```
1. Run /stats
2. Check your usage streak
3. See which model you use most
4. Press Ctrl+S to save a screenshot
5. The image is now in your clipboard!
```

### Exercise 13.3: Monitor Session Cost

```
1. Run /cost
2. Note the current session cost
3. Ask a few questions
4. Run /cost again
5. See how costs accumulate
```

---

## 14. Custom Slash Commands

### Creating Commands

**Project-level (shared with team):**
```bash
mkdir -p .claude/commands
```

**User-level (personal):**
```bash
mkdir -p ~/.claude/commands
```

### Basic Command

**File: `.claude/commands/review.md`**
```markdown
Review this code for:
- Security vulnerabilities
- Performance issues
- Best practices
- Edge cases
```

### Command with Arguments

**File: `.claude/commands/fix-issue.md`**
```markdown
---
description: Fix a GitHub issue by number
argument-hint: [issue-number]
---

Fix GitHub issue #$ARGUMENTS following our coding standards.
Check the issue for context, implement the fix, and create tests.
```

### Command with Tool Restrictions

**File: `.claude/commands/read-only.md`**
```markdown
---
description: Analyze without changes
allowed-tools: Read, Grep, Glob
---

Analyze the codebase but do not make any changes.
```

### Command with Bash Execution

**File: `.claude/commands/deploy-check.md`**
```markdown
---
description: Pre-deployment checklist
---

## Current Status
- Git status: !`git status --short`
- Current branch: !`git branch --show-current`
- Uncommitted changes: !`git diff --stat`

Based on the above, can we safely deploy?
```

### Command with File References

**File: `.claude/commands/onboard.md`**
```markdown
---
description: Onboard to this project
---

Welcome to the project! Here's what you need to know:

@CLAUDE.md - Project conventions
@README.md - Getting started
@package.json - Available commands
```

---

### Exercise 14.1: Create Your First Command

```
1. mkdir -p .claude/commands
2. Create .claude/commands/hello.md with:
   ---
   description: A friendly greeting
   ---

   Say hello and introduce yourself!

3. Run /hello
4. See your custom command in action!
```

### Exercise 14.2: Command with Arguments

```
1. Create .claude/commands/explain.md:
   ---
   description: Explain a concept
   argument-hint: [concept]
   ---

   Explain $ARGUMENTS in simple terms with examples.

2. Run /explain "closures in JavaScript"
```

### Exercise 14.3: Bash-Powered Command

```
1. Create .claude/commands/status.md:
   ---
   description: Project status check
   ---

   ## Quick Status
   - Branch: !`git branch --show-current`
   - Changes: !`git status --short | head -10`

   Summarize the current project status.

2. Run /status
```

---

## 15. Prompt Suggestions

### How They Work

After Claude responds, it may suggest follow-up prompts based on context.

### Interacting with Suggestions

| Action | Key |
|--------|-----|
| Accept and submit | `Enter` |
| Accept and edit | `Tab` |
| Navigate | Arrow keys |
| Ignore | Just type your own prompt |

### Toggle Suggestions

```bash
/config    # Toggle "Prompt suggestions" setting
```

---

### Exercise 15.1: Use a Suggestion

```
1. Ask Claude something that has natural follow-ups:
   "What is dependency injection?"

2. Look for suggestions after the response

3. Press Enter to accept and submit a suggestion
   OR
   Press Tab to accept and edit it first
```

### Exercise 15.2: Toggle Suggestions

```
1. Run /config
2. Find "Prompt suggestions"
3. Toggle it off if you find suggestions distracting
4. Toggle it on if you want guidance
```

---

## 16. LSP (Language Server Protocol)

### What LSP Provides (v2.0.74+)

- Go-to-definition
- Find references
- Hover documentation
- Symbol search
- Type information

### How to Use

LSP is automatic when available. Ask Claude:

```
"What calls the handleAuth function?"
"Where is UserService defined?"
"Show me all references to this variable"
"What type does this function return?"
```

### Installing LSP Support

```bash
/plugin    # Check for LSP plugins in marketplace
```

---

### Exercise 16.1: Find References

```
1. Pick a function in your codebase
2. Ask: "Find all places that call [functionName]"
3. Claude uses LSP to find accurate references
```

### Exercise 16.2: Go to Definition

```
1. Ask: "Where is [ClassName] defined?"
2. Claude navigates to the exact definition
3. This is more accurate than grep for complex codebases
```

---

## 17. Claude in Chrome (Browser Automation)

### What It Does (v2.0.72+)

Control Chrome browser directly from Claude Code:
- Navigate to URLs
- Click elements
- Fill forms
- Take screenshots
- Scrape content
- Automate workflows

### Setup

1. Install the Chrome extension: https://claude.ai/chrome
2. The MCP server is auto-configured

### Common Commands

```
"Go to github.com and search for 'claude code'"
"Take a screenshot of the current page"
"Fill in the login form with test@example.com"
"Click the Submit button"
"Scrape the product titles from this page"
"Navigate back and click the first link"
```

---

### Exercise 17.1: Take a Screenshot

```
1. Ask: "Open a new Chrome tab and go to google.com"
2. Ask: "Take a screenshot of the page"
3. The screenshot appears in your conversation
```

### Exercise 17.2: Navigate and Click

```
1. Ask: "Go to github.com"
2. Ask: "Click on the Explore link"
3. Ask: "Take a screenshot of what you see"
```

### Exercise 17.3: Fill a Form

```
1. Find a form on any website
2. Ask: "Go to [url] and fill the search box with 'test'"
3. Ask: "Submit the form"
```

---

## 18. MCP Servers

### What They Are

MCP (Model Context Protocol) servers connect Claude to external tools:
- GitHub integration
- Slack messaging
- Database access
- Custom APIs
- Browser automation

### Managing Servers

```bash
/mcp                              # View and manage servers
claude mcp list                   # List all configured servers
claude mcp add <name> <url>       # Add new server
claude mcp remove <name>          # Remove server
```

### Adding Servers

**HTTP Server:**
```bash
claude mcp add --transport http stripe https://mcp.stripe.com/mcp
```

**Local Server:**
```bash
claude mcp add --transport stdio github -- npx -y @anthropic-ai/github-mcp
```

### Toggle Servers with @ Mention

```
@github       # Toggle GitHub MCP on/off
@slack        # Toggle Slack MCP on/off
```

---

### Exercise 18.1: View Your MCP Servers

```
1. Run /mcp
2. See which servers are configured
3. Check their connection status
4. View available tools from each
```

### Exercise 18.2: Toggle a Server

```
1. Type @mcp-server-name in your prompt
2. This toggles that server on/off
3. Useful for temporarily enabling/disabling tools
```

---

## 19. Plugins System

### Discovering Plugins

```bash
/plugin                    # Open plugin management
/plugin install            # Browse available plugins
/plugin discover           # Search marketplace
```

### Plugin Search (v2.0.73+)

In the discover screen, type to filter by:
- Plugin name
- Description
- Marketplace

### Managing Plugins

```bash
/plugin list               # List installed plugins
/plugin uninstall <name>   # Remove a plugin
/plugin enable <name>      # Enable a plugin
/plugin disable <name>     # Disable a plugin
```

---

### Exercise 19.1: Browse Plugins

```
1. Run /plugin
2. Select "Discover plugins"
3. Type to search/filter
4. Browse what's available
```

### Exercise 19.2: Install a Plugin

```
1. Run /plugin install
2. Find an interesting plugin
3. Install it
4. Check that new commands are available
```

---

## 20. Hooks System

### What Hooks Do

Execute shell commands at specific lifecycle points:

| Hook | When It Runs |
|------|--------------|
| `PreToolUse` | Before tool execution (can block) |
| `PostToolUse` | After tool completes |
| `PermissionRequest` | When permission prompt appears |
| `UserPromptSubmit` | Before Claude processes input |
| `Notification` | When notifications are sent |
| `Stop` | When Claude finishes |
| `PreCompact` | Before context compaction |
| `SessionStart` | Session begins |
| `SessionEnd` | Session ends |

### Managing Hooks

```bash
/hooks                     # Interactive hook management
```

### Example: Auto-Format on Edit

```json
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $FILE"
          }
        ]
      }
    ]
  }
}
```

---

### Exercise 20.1: View Current Hooks

```
1. Run /hooks
2. See which hooks are configured
3. Understand what they do
```

### Exercise 20.2: Create a Simple Hook

```
1. Run /hooks
2. Add a PostToolUse hook
3. Set matcher to "Edit"
4. Set command to "echo 'File edited: $FILE'"
5. Now every edit logs the filename
```

---

## 21. Custom Agents & Skills

### Custom Agents

Agents are specialized AI assistants with custom system prompts, tools, and models.

**Creating an Agent:**

```bash
/agents                    # Interactive agent management
```

**Manual creation:**
```markdown
<!-- .claude/agents/security-reviewer.md -->
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob
model: opus
---

You are a security expert. Review code for:
- SQL injection
- XSS vulnerabilities
- Authentication issues
- Data exposure
```

### Skills

Skills are modular capabilities Claude uses automatically when relevant.

**Creating a Skill:**
```markdown
<!-- .claude/skills/api-testing/SKILL.md -->
---
name: api-testing
description: Test API endpoints
allowed-tools: Bash, Read, Write
---

# API Testing

Test endpoints using curl:
```bash
curl -X GET "http://localhost:3000/api/endpoint"
```
```

---

### Exercise 21.1: Create a Custom Agent

```
1. Run /agents
2. Create a new agent
3. Give it a specific role (e.g., "documentation writer")
4. Set which tools it can use
5. Use it: "Ask the documentation-writer agent to..."
```

### Exercise 21.2: Use Built-in Agents

```
1. Ask Claude to do an exploration task
2. Watch it use the "Explore" subagent automatically
3. The explore agent is faster for searching
```

---

## 22. Memory System (CLAUDE.md)

### Memory Hierarchy

| Priority | Location | Purpose |
|----------|----------|---------|
| 1 | Project CLAUDE.md | Team conventions |
| 2 | .claude/rules/*.md | Modular rules |
| 3 | ~/.claude/CLAUDE.md | Personal preferences |
| 4 | CLAUDE.local.md | Private project notes |

### Quick Commands

```bash
/init                      # Create project CLAUDE.md
/memory                    # Edit memory files
```

### Adding to Memory

Start a message with `#` to add to memory, or just tell Claude:
```
"Add to my memory that I prefer tabs over spaces"
```

### Import Other Files

In CLAUDE.md:
```markdown
@README.md - Project overview
@docs/api.md - API documentation
@~/.claude/my-patterns.md - My patterns
```

---

### Exercise 22.1: Initialize Project Memory

```
1. Run /init
2. Let Claude create a CLAUDE.md
3. Review what it captured about your project
4. Edit to add your preferences
```

### Exercise 22.2: Edit Memory

```
1. Run /memory
2. Select which memory file to edit
3. Add a preference: "Always use async/await, never callbacks"
4. Save and Claude will remember
```

### Exercise 22.3: Import Files

```
1. Open your CLAUDE.md
2. Add: @docs/coding-standards.md
3. Now that file is always in context
```

---

## 23. Permission System

### Viewing Permissions

```bash
/permissions               # Interactive permission UI
```

### Permission Modes

| Mode | Behavior | Shortcut |
|------|----------|----------|
| Normal | Asks for each new tool | Default |
| Auto-Accept | Auto-approves file edits | Shift+Tab |
| Plan | Read-only analysis | Shift+Tab |

### Permission Rules

```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Bash(npm run test:*)",
      "Read(/src/**)",
      "Edit(/src/**/*.ts)"
    ],
    "deny": [
      "Edit(.env*)",
      "Bash(rm -rf:*)"
    ]
  }
}
```

### Wildcards

```
Bash(npm run:*)           # All npm run commands
Edit(/src/**/*.ts)        # All TS files in src
mcp__github__*            # All GitHub MCP tools
```

---

### Exercise 23.1: View Your Permissions

```
1. Run /permissions
2. Press / to search
3. Type "bash" to filter bash permissions
4. See what's allowed, denied, and ask-mode
```

### Exercise 23.2: Add a Permission

```
1. Run /permissions
2. Add a new allow rule
3. Try: Edit(/src/**/*.tsx)
4. Now all TSX edits are auto-approved
```

---

## 24. Quick Reference Card

### Most Important Shortcuts

```
Ctrl+C          Interrupt Claude
Ctrl+L          Clear screen
Ctrl+R          Search history
Shift+Tab       Cycle permission modes
Alt+T           Toggle thinking
Alt+P           Switch model
Ctrl+B          Background command
Ctrl+Y          Paste killed text
Alt+Y           Cycle kill ring
Tab             Autocomplete files
@               File mention
Esc Esc         Rewind/undo changes
```

### Essential Commands

```
/vim            Enable vim mode
/theme          Change theme
/context        See token usage
/stats          Usage analytics
/compact        Reduce context
/resume         Switch sessions
/memory         Edit CLAUDE.md
/permissions    Manage permissions
/mcp            Manage MCP servers
/hooks          Configure hooks
/terminal-setup Configure terminal
```

### Vim Essentials

```
Esc             Normal mode
i               Insert mode
w / b           Next/prev word
0 / $           Start/end line
dd              Delete line
cw              Change word
.               Repeat last
u               Undo
```

### Daily Workflow

```
1. claude --continue        Resume where you left off
2. /rename task-name        Name your session
3. @file.ts                 Add files to context
4. Shift+Tab               Enter plan mode for exploration
5. Alt+T                   Enable thinking for complex tasks
6. Ctrl+R                  Search history for past solutions
7. /compact                When context gets full
8. /export                 Save important conversations
```

---

## Practice Schedule

### Day 1: Basics
- [ ] Master Ctrl+C, Ctrl+L, Ctrl+R
- [ ] Practice Shift+Tab mode cycling
- [ ] Try @ file mentions

### Day 2: Vim Mode
- [ ] Enable /vim
- [ ] Practice h/j/k/l navigation
- [ ] Learn i, a, o for insert mode
- [ ] Use w, b, e for word movement

### Day 3: Editing
- [ ] Master Ctrl+K, Ctrl+Y kill/yank
- [ ] Practice Alt+Y kill ring cycling
- [ ] Learn vim dd, cw, D commands

### Day 4: Sessions & History
- [ ] Use Ctrl+R for history search
- [ ] Practice /rename and /resume
- [ ] Try forking sessions

### Day 5: Advanced
- [ ] Create a custom slash command
- [ ] Set up a hook
- [ ] Configure permissions
- [ ] Use @ for MCP resources

### Daily Practice
- [ ] Use vim mode for all prompts
- [ ] Background at least one command
- [ ] Use history search instead of retyping
- [ ] @ mention files instead of asking Claude to read

---

## Congratulations!

You now have a complete reference for becoming a Claude Code power user. The key is **consistent practice** - use these features in your daily workflow until they become muscle memory.

**Top 5 habits to build:**
1. Always use vim mode
2. @ mention files instead of asking Claude to read
3. Ctrl+R for history instead of retyping
4. Shift+Tab to enter plan mode before complex changes
5. Background long-running commands with Ctrl+B

Good luck!
