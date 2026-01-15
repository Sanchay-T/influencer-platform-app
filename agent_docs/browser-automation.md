# Browser Automation with agent-browser

**You have a real browser. Use it like a human would.**

When the user asks you to "check something", "go to a site", "verify in browser", or anything that a human would do in a browser — **just do it**. Navigate, click, fill forms, take screenshots, read content.

## Golden Rule

**When unsure what's possible, run:**
```bash
agent-browser --help
```

This shows all 50+ commands. The tool is comprehensive — if a human can do it in a browser, you probably can too.

## Two Modes of Operation

### 1. CDP Mode (Use Existing Chrome)

Connect to user's logged-in Chrome with all their sessions/cookies:

```bash
# User starts Chrome with CDP
chrome-debug                    # Starts Chrome with remote debugging on :9222

# You connect to it
ab check                        # Verify CDP is ready
ab open github.com              # Browse as the user (logged in)
```

**When to use:** Testing authenticated flows, accessing user's accounts, anything that needs their login state.

### 2. Session Mode (Standalone Browser)

Start a fresh browser instance that persists across commands:

```bash
agent-browser --session mytest open https://example.com
agent-browser --session mytest click @e1
agent-browser --session mytest snapshot -i
```

**When to use:** Isolated testing, streaming/pair-browsing, when you don't need user's auth.

---

## Streaming (Remote/Headless Viewing)

Stream browser viewport over WebSocket — useful when you can't see the browser directly.

### When You Need Streaming

| Scenario | Use streaming? |
|----------|----------------|
| **Headed + local** | No — just look at the window |
| **Headless + local** | Yes — no window to look at |
| **Remote server** | Yes — browser isn't on your machine |
| **Recording/capture** | Yes — programmatic frame capture |
| **Multiple viewers** | Yes — one browser, many watchers |

**For local dev, skip streaming.** Just use `--headed` and look at the Chrome window.

### Setup (When You Need It)

```bash
# Start headless browser with streaming
AGENT_BROWSER_STREAM_PORT=9223 agent-browser --session demo open <url>

# Open viewer (connects to ws://localhost:9223)
open ~/stream-viewer.html

# Commands are streamed live
agent-browser --session demo click @e5
agent-browser --session demo scroll down 300

# Close when done
agent-browser --session demo close
```

### Key Points

- **Requires `--session` flag** — without it, browser closes after each command
- Stream sends base64 JPEG frames at ~10fps
- Viewer at `~/stream-viewer.html` (or any WebSocket client)

---

## JSON Output (Agent Mode)

For reliable parsing instead of text grep:

```bash
# Text output (human readable)
agent-browser snapshot -i
# - button "Submit" [ref=e1]
# - textbox "Email" [ref=e2]

# JSON output (machine parseable)
agent-browser snapshot -i --json
# {"elements": [{"role": "button", "name": "Submit", "ref": "e1"}, ...]}
```

### Commands That Support `--json`

```bash
agent-browser snapshot --json           # Full element tree as JSON
agent-browser snapshot -i --json        # Interactive elements only
agent-browser get text @e1 --json       # {"text": "Hello World"}
agent-browser get url --json            # {"url": "https://..."}
agent-browser get count ".item" --json  # {"count": 5}
agent-browser is visible @e1 --json     # {"visible": true}
agent-browser is enabled @e1 --json     # {"enabled": false}
```

### When to Use JSON

- Parsing complex pages with many elements
- Conditional logic based on element state
- Counting items reliably
- When grep patterns might be ambiguous

### JSON Parsing Pattern

```bash
# Check if button is enabled before clicking
enabled=$(agent-browser is enabled @e1 --json | jq -r '.enabled')
if [ "$enabled" = "true" ]; then
  agent-browser click @e1
fi

# Get element count
count=$(agent-browser get count ".row" --json | jq -r '.count')
echo "Found $count rows"
```

---

## CDP Setup (One-Time)

Chrome profiles are copied to `~/chrome-debug-profile/` with CDP enabled.

**Profiles available:**
- `Default` = Sanchay-T (GitHub, Linear, etc.)
- `Profile 4` = tryripe.ai

**Start Chrome with CDP:**
```bash
chrome-debug              # Default profile
chrome-debug "Profile 4"  # Alternate profile
```

**Refresh profiles** (if user logs into new sites in main Chrome):
```bash
pkill -f "Google Chrome"
cp -R "$HOME/Library/Application Support/Google/Chrome/Default" ~/chrome-debug-profile/
cp -R "$HOME/Library/Application Support/Google/Chrome/Profile 4" ~/chrome-debug-profile/
chrome-debug
```

---

## Context-Efficient Wrapper (`ab`)

Use the `ab` wrapper (`~/bin/ab`) to minimize tokens and add convenience features.

### Usage

```bash
ab [--session <name>] [--json] [--headed] <command> [args...]
```

### Flags

| Flag | Purpose |
|------|---------|
| `--session <name>` | Use session mode instead of CDP |
| `--json` | Return JSON output (where supported) |
| `--headed` | Show browser window (session mode) |

### Core Commands

```bash
ab check                    # Verify CDP/session is ready
ab go <url>                 # Open + wait + compact snapshot
ab snap                     # Quick compact snapshot
ab shot [file]              # Screenshot (auto-named if no file)
ab close                    # Close browser
```

### Convenience Commands (Return Clean Values)

```bash
ab visible @e1              # → true or false
ab enabled @e1              # → true or false
ab checked @e1              # → true or false
ab count ".row"             # → 5 (number)
ab text @e1                 # → text content
ab url                      # → current URL
```

### Form Helpers

```bash
ab fp "Email" "test@x.com"           # Fill by placeholder text
ab fill-all @e1 "v1" @e2 "v2"        # Fill multiple refs
ab form "field|value" "submit|@e3"   # Fill form (| delimiter)
```

### Multi-Command

```bash
ab do "click @e1" "press Enter"      # Run multiple commands
ab chain click @e1 , fill @e2 hi     # Commands separated by comma
```

### Combined Examples

```bash
# Session mode with headed browser
ab --session test --headed open https://example.com
ab --session test snap
ab --session test close

# JSON output
ab snap --json
ab --json is visible @e1

# Surgical verification with clean output
ab go "http://localhost:3000/dashboard"
ab visible "[data-testid='sidebar']"   # → true
ab count "[data-testid='card']"        # → 3
```

**Why this matters:** Each Bash call costs tokens. Convenience commands return clean values for scripting.

---

## Command Reference

### Navigation
```bash
open <url>                # Navigate to URL
back                      # Go back
forward                   # Go forward
reload                    # Reload page
```

### Interaction
```bash
click <sel>               # Click element
dblclick <sel>            # Double-click
fill <sel> <text>         # Clear and fill input
type <sel> <text>         # Type into element (appends)
press <key>               # Press key (Enter, Tab, Control+a)
hover <sel>               # Hover element
select <sel> <val>        # Select dropdown option
check <sel>               # Check checkbox
uncheck <sel>             # Uncheck checkbox
scroll <dir> [px]         # Scroll (up/down/left/right)
```

### Get Info
```bash
get text <sel>            # Get text content
get html <sel>            # Get innerHTML
get value <sel>           # Get input value
get attr <sel> <attr>     # Get attribute
get title                 # Get page title
get url                   # Get current URL
get count <sel>           # Count matching elements
get box <sel>             # Get bounding box
```

### Check State
```bash
is visible <sel>          # Check if visible
is enabled <sel>          # Check if enabled
is checked <sel>          # Check if checked
```

### Screenshots & Snapshots
```bash
snapshot                  # Full accessibility tree
snapshot -i               # Interactive elements only (recommended)
snapshot -c               # Compact (remove empty elements)
snapshot -d 3             # Limit depth
snapshot -s "#main"       # Scope to selector
snapshot --json           # JSON output for parsing

screenshot [path]         # Screenshot
screenshot --full         # Full page screenshot
pdf <path>                # Save as PDF
```

### Wait
```bash
wait <selector>           # Wait for element
wait <ms>                 # Wait for time
wait --text "Welcome"     # Wait for text
wait --url "**/dash"      # Wait for URL pattern
```

### Tabs
```bash
tab                       # List tabs
tab new [url]             # New tab
tab <n>                   # Switch to tab n
tab close [n]             # Close tab
```

### Cookies & Storage
```bash
cookies                   # Get all cookies
cookies set <name> <val>  # Set cookie
cookies clear             # Clear cookies

storage local             # Get localStorage
storage local <key>       # Get specific key
storage local set <k> <v> # Set value
storage local clear       # Clear all
```

### Debug
```bash
console                   # View console messages
errors                    # View page errors
highlight <sel>           # Highlight element
trace start [path]        # Start recording
trace stop [path]         # Stop and save trace
```

---

## Selectors

### Refs (Recommended)
From `snapshot` output, use refs like `@e1`, `@e2`:
```bash
snapshot -i
# Output:
# - button "Submit" [ref=e1]
# - textbox "Email" [ref=e2]

click @e1
fill @e2 "test@example.com"
```

### CSS Selectors
```bash
click "#id"
click ".class"
click "[data-testid='submit']"
```

### Semantic Locators
```bash
find role button click --name "Submit"
find label "Email" fill "test@test.com"
find placeholder "Search..." fill "query"
find testid "submit-btn" click
```

---

## Surgical Verification Patterns

**After coding a feature, verify with minimal commands.** Don't navigate through menus — go direct.

### The Pattern

```bash
# 1. Direct URL to the feature
ab go "http://localhost:3000/path/to/feature"

# 2. Targeted check (pick ONE):
ab get text "[data-testid='feature']"     # Text content
ab is visible "[data-testid='feature']"   # Exists?
ab snap | grep -i "expected text"          # Quick search
ab shot verify.png                          # Visual proof

# Or with JSON for reliability:
ab is visible "[data-testid='feature']" --json | jq '.visible'
```

### By Feature Type

**Button added:**
```bash
ab go "<direct-url>" && ab snap | grep -i "button-name"
# Or: ab is visible "[data-testid='btn']" --json
```

**Form field added:**
```bash
ab go "<direct-url>"
ab fp "Placeholder Text" "test value"
ab shot form-filled.png
```

**List/table renders data:**
```bash
ab go "<direct-url>" && sleep 2
ab get count "[data-testid='row']" --json  # {"count": 10}
```

**Modal/dialog appears:**
```bash
ab go "<direct-url>"
ab click "[data-testid='trigger']" && sleep 1
ab is visible "[role='dialog']" --json
ab shot modal-open.png
```

**API data displays:**
```bash
ab go "<direct-url>" && sleep 3
ab get text "[data-testid='data-container']"
```

**Error state shows:**
```bash
ab go "<url-that-triggers-error>"
ab snap | grep -i "error\|failed\|invalid"
```

### Anti-Patterns (Avoid)

```bash
# DON'T: Full exploratory flow
ab go "http://localhost:3000"
ab snap                          # Huge output
ab click @e5                     # Navigate
ab snap                          # Another huge output
ab click @e12                    # Navigate more
ab snap                          # Yet another...

# DO: Direct surgical check
ab go "http://localhost:3000/exact/path" && ab snap | grep "New Button"
```

### When to Use Full Exploration

Only when:
1. You don't know the URL structure
2. User asks you to "walk through the flow"
3. You're debugging navigation/routing issues
4. First time seeing a feature area

### Verification Checklist

Before testing, answer:

1. **What changed?** (button, form, data display, styling)
2. **What's the direct URL?** (construct it, don't navigate)
3. **What's the ONE check?** (text exists, count > 0, visible, screenshot)
4. **What proves success?** (specific text, element count, visual)

---

## Common Patterns

### Form Handling
- If button shows `[disabled]`, fill required fields first
- If field not in `-i` snapshot, use: `find placeholder "text" fill "value"`
- After clicking Submit, `sleep 2` then re-snapshot

### Stripe Checkout (Test Mode)
```bash
fill @cardNumber "4242424242424242"
fill @expiry "1230"
fill @cvc "123"
fill @name "Test User"
click @submitButton
```

### Waiting for Async
```bash
# After submitting something that takes time
sleep 5
ab shot progress.png
ab snap
```

### Ref Lifecycle
- `@e1`, `@e2`, etc. are assigned fresh each snapshot
- After page change, old refs are INVALID — must re-snapshot
- `[disabled]` tag means button won't work yet
- `[checked]`, `[selected]`, `[pressed]` show current state

---

## Troubleshooting

### When something doesn't work
1. **Take a screenshot** — reveals validation errors, loading states, UI you missed
2. **Re-snapshot** — page may have changed, refs are stale
3. **Use full `snapshot`** (without `-i`) — some fields aren't marked "interactive"
4. **Check `console` and `errors`** — might be JS errors

### CDP not connecting
```bash
lsof -i :9222                    # Check if Chrome is listening
# If not: chrome-debug
```

### Streaming not working
- Must use `--session` flag — without it, browser closes after each command
- Check port: `lsof -i :9223`

---

## Quick Reference Card

```bash
# Setup (CDP mode - uses your logged-in Chrome)
chrome-debug                     # Start CDP Chrome
ab check                         # Verify ready

# Setup (Session mode - fresh browser)
ab --session test --headed open <url>
ab --session test check

# Navigate & Capture
ab go <url>                      # Open + snapshot
ab snap                          # Quick snapshot
ab snap --json                   # JSON snapshot
ab shot                          # Screenshot

# Interact
ab click @e1                     # Click ref
ab fill @e1 "text"               # Fill input
ab fp "Placeholder" "value"      # Fill by placeholder
ab press Enter                   # Press key

# Verify (convenience - return clean values)
ab visible @e1                   # → true or false
ab enabled @e1                   # → true or false
ab count ".row"                  # → number
ab text @e1                      # → text content
ab url                           # → current URL

# Verify (raw JSON)
ab is visible @e1 --json         # {"visible": true}
ab get count ".row" --json       # {"count": 5}

# Close
ab close                         # CDP mode
ab --session test close          # Session mode
```
