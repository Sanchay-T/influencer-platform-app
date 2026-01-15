# Claude + Obsidian Integration

## Why They Pair Well

> "Obsidian is YOUR interface to your knowledge base. Claude Code is CLAUDE's interface."

An Obsidian vault is essentially a **codebase of markdown files** stored in the filesystem. Claude Code is designed to navigate file structures and make targeted edits — perfect for knowledge management.

---

## Integration Methods

### 1. Claude Code (Direct Filesystem Access)

**No plugin needed.** Just run Claude Code in your vault directory.

```bash
cd ~/Documents/ObsidianVault
claude
```

Claude can:
- Read/write/edit any markdown file
- Search across all notes
- Add backlinks, tags, metadata
- Reorganize folder structure
- Generate new notes from templates

### 2. MCP Servers (For Claude Desktop)

Connect Claude Desktop to Obsidian via Model Context Protocol.

**Popular MCP Servers:**

| Server | Method | Features |
|--------|--------|----------|
| [obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp) | WebSocket | Auto-discovery, Claude Code native |
| [mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) | REST API | Requires Local REST API plugin |
| [mcp-tools](https://github.com/jacksteamdev/obsidian-mcp-tools) | Plugin | Semantic search, Templater integration |
| [claudesidian-mcp](https://github.com/heyitsnoah/claudesidian) | Plugin | Memory system, atomic operations |

### 3. Obsidian Plugins

| Plugin | What It Does |
|--------|--------------|
| **claudian** | Sidebar chat interface (275 stars) |
| **obsidian-claude-code** | SDK-based integration |
| **Agent Client Plugin** | Multi-agent support (Claude, Codex, Gemini) |

---

## Claude Desktop MCP Setup

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

**Example config:**

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:22360/sse"],
      "env": {}
    }
  }
}
```

Restart Claude Desktop after editing. Test with: "What files are in my Obsidian vault?"

---

## Core Use Cases

### 1. Automated Backlinking

```
"Read my journal entry from today and add backlinks to all people, places, and books mentioned."
```

Claude searches vault for existing notes, creates new ones if needed, adds wiki-links.

### 2. Note Organization

```
"Go through the files in this folder, figure out the patterns, and write a script to put information like A into location B."
```

### 3. Batch Processing

```
"Clean up my 10,000 legacy notes: add metadata, insert backlinks, reconnect orphan notes."
```

### 4. Research Synthesis

```
"Based on my notes about X, what would I have said about Y?"
```

Claude reasons from YOUR perspective using your knowledge base.

### 5. Daily Workflows

```
"Pull yesterday's notes, GitHub PRs, and old entries from this date in previous years."
```

---

## Recommended Vault Structure

```
00_Inbox/           # Temporary capture
01_Projects/        # Active initiatives
02_Areas/           # Ongoing responsibilities
03_Resources/       # Reference materials
04_Archive/         # Completed items
05_Attachments/     # Files
06_Metadata/        # Templates, config
skills/             # Reusable Claude prompts
CLAUDE.md           # AI role + rules
```

---

## Custom Commands for Claude Code

Create in `.claude/commands/` when working in vault:

### `/today` — Daily Startup
```markdown
Pull and summarize:
- Yesterday's journal entry
- Any GitHub PRs from yesterday
- Notes from this date in previous years
- Today's calendar events
```

### `/journal` — Quick Logging
```markdown
Create a journal entry for today with:
- Current mood
- Key thoughts
- Action items
```

### `/weekly-review` — Aggregated Summary
```markdown
Review all notes from this week:
- Key decisions made
- Projects progressed
- Ideas captured
- Next week priorities
```

### `/vault-health` — Maintenance
```markdown
Analyze vault for:
- Broken links
- Orphaned notes
- Missing tags
- Duplicate content
```

---

## Automation Patterns

### Pattern 1: Daily Sync Chain

```
Meeting (Granola) → Auto-import to Obsidian → Claude processes → Backlinks added
```

### Pattern 2: Research Pipeline

```
Define scope → Claude pulls sources (Exa MCP) → Synthesizes → Stores in vault
```

### Pattern 3: Content Production

```
Daily notes → Weekly reflection → Monthly review → Generated content (blog, social)
```

### Pattern 4: Backup-Execute

```
Claude writes script → Backs up directory → Executes edits safely
```

---

## Quality Control

| Safeguard | Implementation |
|-----------|----------------|
| **Git tracking** | Review changes via `git diff` |
| **AI tagging** | Mark generated content with `<ai-suggestion>` |
| **Folder permissions** | Grant access only to specific folders |
| **Weekly audits** | Manual review of Claude outputs |
| **Version control** | Auto-commit changes |

---

## Twitter Workflows (Community Examples)

**@braindedxx:**
> "Indexed my entire users/'user' folder + 2 GitHub accounts. Use the vault for better grounding & NotebookLM MCP for deep research."

**@_grojo:**
> "I have an MCP running locally over obsidian on a home server… use it as a natural language query system for my whole life."

**@svenkataram (LifeOS):**
> Personal operating system with subfolders: reading inbox, projects, CRM + calendar/email connections. Auto-processes daily inputs.

**@RonnyKhalil (Batch Refactoring):**
> Reviving 10,000+ legacy notes through systematic cleaning, metadata enrichment, backlink insertion.

**@frihyde (Research):**
> "Think NotebookLM personalized" — bidirectional claim-to-paper decomposition; Claude accesses Zotero via MCP.

---

## Limitations & Gotchas

| Issue | Solution |
|-------|----------|
| Append permission failures | Use write mode instead |
| API success rate ~75% | Include verification steps |
| Mobile access blocked | Desktop-only for vault access |
| High token consumption | Control exploration scope |
| Obsidian Sync issues | Separate .claude subdirectory |

---

## Minimal Viable Setup

1. **Create `CLAUDE.md`** in vault root (role + rules)
2. **Set up `/today` command** for daily context
3. **Build one skill template** in `skills/`
4. **Connect one MCP** (GitHub or Calendar)
5. **Daily 10-minute audit** of Claude changes
6. **Auto-commit** to version control

This foundation scales to full LifeOS without redesign.

---

## Key Insight

> "Where AI fails is often a failure of context, rather than ability."

Obsidian provides the persistent context layer. Claude provides the intelligence. Together: personalized assistant with YOUR knowledge.

---

## Sources

- [Obsidian × Claude Code Workflow Guide](https://www.axtonliu.ai/newsletters/ai-2/posts/obsidian-claude-code-workflows)
- [Using Claude Code with Obsidian](https://kyleygao.com/blog/2025/using-claude-code-with-obsidian/)
- [How Claude + Obsidian + MCP Solved My Problems](https://www.eleanorkonik.com/p/how-claude-obsidian-mcp-solved-my)
- [obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp)
- [mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian)
- [MCP Tools for Obsidian](https://github.com/jacksteamdev/obsidian-mcp-tools)
- [Connecting Raw Thoughts to Claude](https://erickhun.com/posts/partner-os-claude-mcp-obsidian/)
